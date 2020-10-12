import { GraphQLBoolean, GraphQLNonNull, GraphQLObjectType, GraphQLString } from 'graphql';
import { pick } from 'lodash';

import models from '../../../models';
import { setupCreditCard } from '../../../paymentProviders/stripe/creditcard';
import { Forbidden } from '../../errors';
import { AccountReferenceInput, fetchAccountWithReference } from '../input/AccountReferenceInput';
import { CreditCardCreateInput } from '../input/CreditCardCreateInput';
import { fetchPaymentMethodWithReference, PaymentMethodReferenceInput } from '../input/PaymentMethodReferenceInput';
import { PaymentMethod } from '../object/PaymentMethod';
import { StripeError } from '../object/StripeError';

const CreditCardWithStripeError = new GraphQLObjectType({
  name: 'CreditCardWithStripeError',
  fields: {
    paymentMethod: {
      type: new GraphQLNonNull(PaymentMethod),
      description: 'The payment method created',
    },
    stripeError: {
      type: StripeError,
      description: 'This field will be set if there was an error with Stripe during strong customer authentication',
    },
    shouldBeSaved: {
      type: GraphQLBoolean,
      description: 'If the Payment Method needs to be marked as saved again during confirmCreditCard',
    },
  },
});

const addCreditCard = {
  type: GraphQLNonNull(CreditCardWithStripeError),
  description: 'Add a new payment method to be used with an Order',
  args: {
    creditCardInfo: {
      type: new GraphQLNonNull(CreditCardCreateInput),
      description: 'The credit card info',
    },
    name: {
      type: new GraphQLNonNull(GraphQLString),
      description: 'Name associated to this credit card',
    },
    isSavedForLater: {
      type: GraphQLBoolean,
      description: 'Whether this credit card should be saved for future payments',
      defaultValue: true,
    },
    account: {
      type: new GraphQLNonNull(AccountReferenceInput),
      description: 'Account to add the credit card to',
    },
  },
  async resolve(_, args, req) {
    const collective = await fetchAccountWithReference(args.account, { throwIfMissing: true });
    if (!req.remoteUser.isAdminOfCollective(collective)) {
      throw new Forbidden(`Must be an admin of ${collective.name}`);
    }

    const newPaymentMethodData = {
      service: 'stripe',
      type: 'creditcard',
      name: args.name,
      CreatedByUserId: req.remoteUser.id,
      currency: collective.currency,
      saved: args.isSavedForLater,
      CollectiveId: collective.id,
      token: args.creditCardInfo.token,
      data: pick(args.creditCardInfo, ['brand', 'country', 'expMonth', 'expYear', 'fullName', 'funding', 'zip']),
    };

    let pm = await models.PaymentMethod.create(newPaymentMethodData);

    try {
      pm = await setupCreditCard(pm, { collective, user: req.remoteUser });
    } catch (error) {
      if (!error.stripeResponse) {
        throw error;
      }

      // unsave payment method if saved, we will resave it in confirmCreditCard
      await pm.update({ saved: false });

      pm.stripeError = {
        message: error.message,
        account: error.stripeAccount,
        response: error.stripeResponse,
      };

      return { paymentMethod: pm, stripeError: pm.stripeError, shouldBeSaved: args.isSavedForLater };
    }

    // Success: delete reference to setupIntent and mark again as saved if needed
    if (pm.data.setupIntent) {
      delete pm.data.setupIntent;
    }

    await pm.update({ confirmedAt: new Date(), data: pm.data });

    return { paymentMethod: pm };
  },
};

const confirmCreditCard = {
  type: GraphQLNonNull(CreditCardWithStripeError),
  description: 'Confirm a credit card is ready for use after strong customer authentication',
  args: {
    paymentMethod: {
      type: new GraphQLNonNull(PaymentMethodReferenceInput),
    },
    shouldBeSaved: {
      type: GraphQLBoolean,
      description: 'Whether this payment method should be marked as saved for future payments',
    },
  },
  async resolve(_, args, req) {
    const paymentMethod = await fetchPaymentMethodWithReference(args.paymentMethod);

    // Success: delete reference to setupIntent and mark again as saved if needed
    if (paymentMethod.data.setupIntent) {
      delete paymentMethod.data.setupIntent;
    }

    await paymentMethod.update({
      confirmedAt: new Date(),
      data: paymentMethod.data,
      saved: args.shouldBeSaved,
    });

    return { paymentMethod };
  },
};

const paymentMethodMutations = {
  addCreditCard,
  addStripeCreditCard: {
    ...addCreditCard,
    deprecationReason: '2020-08-24: Use addCreditCard',
  },
  confirmCreditCard,
};

export default paymentMethodMutations;
