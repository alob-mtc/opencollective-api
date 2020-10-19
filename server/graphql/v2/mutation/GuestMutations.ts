import config from 'config';
import { GraphQLBoolean, GraphQLList, GraphQLNonNull, GraphQLString } from 'graphql';

import emailLib from '../../../lib/email';
import { confirmGuestAccount } from '../../../lib/guest-accounts';
import RateLimit from '../../../lib/rate-limit';
import models from '../../../models';
import { BadRequest, NotFound, RateLimitExceeded } from '../../errors';
import { Account } from '../interface/Account';

const guestMutations = {
  sendGuestConfirmationEmail: {
    type: new GraphQLNonNull(GraphQLBoolean),
    description: 'Sends an email for guest to confirm their emails and create their Open Collective account',
    args: {
      email: {
        type: new GraphQLNonNull(GraphQLString),
        description: 'The email to validate',
      },
    },
    async resolve(_: void, args: Record<string, unknown>, req: Record<string, unknown>): Promise<boolean> {
      // Only for unauthenticated users
      if (req.remoteUser) {
        throw new BadRequest(
          "You're signed in, which means your account is already verified. Sign out first if you want to verify another account.",
        );
      }

      // Make sure that this cannot be abused to guess email addresses
      const rateLimitOnIP = new RateLimit(
        `confirm_guest_account_ip_${req.ip}}`,
        config.limits.confirmGuestEmailPerMinutePerIp,
        60,
      );

      if (!(await rateLimitOnIP.registerCall())) {
        throw new RateLimitExceeded('An email has already been sent recently. Please try again in a few minutes.');
      }

      // Make sure that we don't send more than one email per minute for each address
      const email = (<string>args.email).trim().toLowerCase();
      const rateLimitOnEmail = new RateLimit(
        `confirm_guest_account_email_${Buffer.from(email).toString('base64')}`,
        config.limits.confirmGuestEmailPerMinute,
        60,
      );

      if (!(await rateLimitOnEmail.registerCall())) {
        throw new RateLimitExceeded(
          'An email has already been sent for this address recently. Please check your SPAM folder, or try again in a few minutes.',
        );
      }

      // Load data
      const user = await models.User.findOne({
        where: { email },
        include: [{ association: 'collective', required: true }],
      });

      if (!user) {
        throw new NotFound('No user found for this email address');
      } else if (user.confirmedAt) {
        throw new BadRequest('This account has already been confirmed');
      }

      // Send email
      await emailLib.send('confirm-guest-account', user.email, {
        email: user.email,
        verifyAccountLink: `${config.host.website}/confirm/guest/${user.emailConfirmationToken}?email=${user.email}`,
      });

      return true;
    },
  },
  confirmGuestAccount: {
    type: new GraphQLNonNull(Account),
    description: 'Mark an account as confirmed',
    args: {
      emailConfirmationToken: {
        type: new GraphQLNonNull(GraphQLString),
        description: 'The key that you want to edit in settings',
      },
      guestTokens: {
        type: new GraphQLList(new GraphQLNonNull(GraphQLString)),
        description: 'This can be used to link the other guest contributions to the user',
      },
      name: {
        type: GraphQLString,
        description: 'Use this to set the profile name if not set already',
      },
    },
    async resolve(_: void, args: Record<string, unknown>): Promise<typeof models.Collective> {
      const guestTokens = <string[] | null>args.guestTokens;
      if (guestTokens?.length > 30) {
        throw new Error('Cannot link more than 30 profiles at the same time');
      }

      return confirmGuestAccount(<string>args.emailConfirmationToken, <string>args.name);
    },
  },
};

export default guestMutations;
