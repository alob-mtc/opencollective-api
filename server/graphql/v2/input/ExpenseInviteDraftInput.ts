import { GraphQLBoolean, GraphQLInputObjectType, GraphQLList, GraphQLNonNull, GraphQLString } from 'graphql';
import GraphQLJSON from 'graphql-type-json';

import { ExpenseType } from '../enum/ExpenseType';

import { LocationInput } from './LocationInput';

const ExpenseInvitee = new GraphQLInputObjectType({
  name: 'ExpenseInvitee',
  fields: {
    name: { type: GraphQLString },
    email: { type: GraphQLString },
    isInvite: { type: GraphQLBoolean },
  },
});

/**
 * Input type to use as the type for the expense input in createExpense mutation.
 */
export const ExpenseInviteDraftInput = new GraphQLInputObjectType({
  name: 'ExpenseInviteDraftInput',
  fields: {
    description: {
      type: GraphQLString,
      description: 'Main title of the expense',
    },
    longDescription: {
      type: GraphQLString,
      description: 'Longer text to attach to the expense',
    },
    tags: {
      type: new GraphQLList(GraphQLString),
      description: 'Tags associated to the expense (ie. Food, Engineering...)',
    },
    type: {
      type: new GraphQLNonNull(ExpenseType),
      description: 'The type of the expense',
    },
    privateMessage: {
      type: GraphQLString,
      description: 'A private note that will be attached to your invoice, as HTML',
    },
    invoiceInfo: {
      type: GraphQLString,
      description: 'Tax ID, VAT number...etc This information will be printed on your invoice.',
    },
    items: {
      type: new GraphQLList(GraphQLJSON),
      description: 'The list of items for this expense. Total amount will be computed from them.',
    },
    attachedFiles: {
      type: new GraphQLList(GraphQLJSON),
      description: '(Optional) A list of files that you want to attach to this expense',
    },
    payee: {
      type: new GraphQLNonNull(ExpenseInvitee),
      description: 'Account to reimburse',
    },
    payeeLocation: {
      type: LocationInput,
      description: 'The address of the payee',
    },
  },
});
