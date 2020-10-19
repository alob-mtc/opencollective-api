import { expect } from 'chai';
import gqlV2 from 'fake-tag';
import sinon from 'sinon';

import emailLib from '../../../../../server/lib/email';
import { randEmail } from '../../../../stores';
import { fakeUser } from '../../../../test-helpers/fake-data';
import { graphqlQueryV2, resetTestDB, waitForCondition } from '../../../../utils';

const SEND_CONFIRMATION_MUTATION = gqlV2/* GraphQL */ `
  mutation SendGuestConfirmation($email: String!) {
    sendGuestConfirmationEmail(email: $email)
  }
`;

const callSendConfirmation = (email, remoteUser = null) => {
  return graphqlQueryV2(SEND_CONFIRMATION_MUTATION, { email }, remoteUser);
};

describe('server/graphql/v2/mutation/IndividualMutations', () => {
  let sandbox, emailSendMessageSpy;

  before(async () => {
    await resetTestDB();
    sandbox = sinon.createSandbox();
    emailSendMessageSpy = sandbox.spy(emailLib, 'sendMessage');
  });

  describe('sendGuestConfirmationEmail', () => {
    it('rejects if the user is signed in', async () => {
      const user = await fakeUser();
      const result = await callSendConfirmation(randEmail(), user);
      expect(result.errors).to.exist;
      expect(result.errors[0].message).to.include("You're signed in");
    });

    it('rejects if the user is already verified', async () => {
      const user = await fakeUser();
      const result = await callSendConfirmation(user.email);
      expect(result.errors).to.exist;
      expect(result.errors[0].message).to.include('This account has already been confirmed');
    });

    it('rejects if the user does not exist', async () => {
      const result = await callSendConfirmation(randEmail());
      expect(result.errors).to.exist;
      expect(result.errors[0].message).to.include('No user found for this email address');
    });

    it('is rate limited on IP', async () => {
      // TODO
    });

    it('is rate limited on email', async () => {
      // TODO
    });

    it('sends the confirmation email', async () => {
      const user = await fakeUser({ confirmedAt: null });
      const result = await callSendConfirmation(user.email);
      result.errors && console.error(result.errors);
      expect(result.errors).to.not.exist;
      expect(result.data.sendGuestConfirmationEmail).to.be.true;

      console.log(emailSendMessageSpy);

      // await waitForCondition(() => emailSendMessageSpy.callCount == 1);
      // expect(emailSendMessageSpy.callCount).to.equal(1);

      // const hostEmailArgs = emailSendMessageSpy.args.find(callArgs => callArgs[1].includes('would love to be hosted'));
      // expect(hostEmailArgs).to.exist;

      // const pendingEmailArgs = emailSendMessageSpy.args.find(callArgs =>
      //   callArgs[1].includes('New pending financial contribution'),
      // );
      // expect(pendingEmailArgs).to.exist;

      // const actionRequiredEmailArgs = emailSendMessageSpy.args.find(callArgs =>
      //   callArgs[1].includes('ACTION REQUIRED'),
      // );
      // expect(actionRequiredEmailArgs).to.exist;
      // expect(actionRequiredEmailArgs).to.exist;
      // expect(actionRequiredEmailArgs[0]).to.equal(remoteUser.email);
      // expect(actionRequiredEmailArgs[2]).to.match(/IBAN 1234567890987654321/);
      // expect(actionRequiredEmailArgs[2]).to.match(
      //   /for the amount of \$20 with the mention: webpack event backer order: [0-9]+/,
      // );
    });
  });
});
