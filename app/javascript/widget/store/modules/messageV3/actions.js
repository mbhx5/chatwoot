import MessageAPI from 'widget/api/message';
import { sendMessageAPI, sendAttachmentAPI } from 'widget/api/conversationV3';
import ConversationMeta from 'widget/store/modules/models/ConversationMeta';
import MessageMeta from 'widget/store/modules/models/MessageMeta';
import Message from 'widget/store/modules/models/Message';

import {
  createTemporaryMessage,
  createTemporaryAttachmentMessage,
  createAttachmentParams,
} from './helpers';

export const actions = {
  addOrUpdate: async (store, message) => {
    const { id: messageId, echo_id: echoId } = message;

    const echoMessage = Message.query()
      .where('echo_id', echoId)
      .first();

    if (echoMessage) {
      Message.update({
        where: echo => echo.echo_id === echoId,
        data: {
          ...message,
          id: messageId,
        },
      });
    } else {
      Message.insert({
        data: [
          {
            ...message,
            id: messageId,
          },
        ],
      });
    }
  },
  sendMessageIn: async (store, params) => {
    const { content, conversationId } = params;
    try {
      ConversationMeta.insertOrUpdate({
        data: {
          id: conversationId,
          isCreating: true,
        },
      });

      const message = createTemporaryMessage({ content, conversationId });
      Message.insert({
        data: {
          ...message,
        },
      });
      const { echo_id: echoId } = message;
      const { data: newMessage } = await sendMessageAPI(content, echoId);

      Message.delete(echoId);
      Message.insert({
        data: [
          {
            ...newMessage,
            echo_id: undefined,
          },
        ],
      });
    } catch (error) {
      throw new Error(error);
    } finally {
      ConversationMeta.insertOrUpdate({
        data: {
          id: conversationId,
          isCreating: false,
        },
      });
    }
  },

  sendAttachmentIn: async (store, params) => {
    const {
      attachment: { thumbUrl, fileType },
      conversationId,
    } = params;
    try {
      ConversationMeta.insertOrUpdate({
        data: {
          id: conversationId,
          isCreating: true,
        },
      });
      const tempMessage = createTemporaryAttachmentMessage({
        thumbUrl,
        fileType,
        conversationId,
      });

      const { id: echoId } = tempMessage;
      const attachmentParams = createAttachmentParams(params);

      Message.insert({
        data: {
          ...tempMessage,
        },
      });

      const { data } = await sendAttachmentAPI(attachmentParams);

      Message.update({
        where: echoId,
        data: {
          ...data,
        },
      });
    } catch (error) {
      throw new Error(error);
    } finally {
      ConversationMeta.insertOrUpdate({
        data: {
          id: conversationId,
          isCreating: false,
        },
      });
    }
  },

  update: async ({ dispatch }, params) => {
    const { email, messageId, submittedValues } = params;
    try {
      MessageMeta.insertOrUpdate({
        data: {
          id: messageId,
          isUpdating: true,
        },
      });
      await MessageAPI.update({
        email,
        messageId,
        values: submittedValues,
      });
      Message.update({
        where: messageId,
        data: {
          content_attributes: {
            submitted_email: email,
            submitted_values: email ? null : submittedValues,
          },
        },
      });

      dispatch('contact/get', {}, { root: true });
    } catch (error) {
      throw new Error(error);
    } finally {
      MessageMeta.insertOrUpdate({
        data: {
          id: messageId,
          isUpdating: false,
        },
      });
    }
  },
};