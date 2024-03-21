import {
  Canister,
  Err,
  None,
  Ok,
  Opt,
  Record,
  Result,
  Some,
  StableBTreeMap,
  Variant,
  Vec,
  Void,
  ic,
  nat64,
  query,
  text,
  update,
} from "azle";
import { v4 as uuidv4 } from "uuid";

/**
 * This type represents a message that can be listed on a board.
 */
const Message = Record({
  id: text,
  body: text,
  createdAt: nat64,
  updatedAt: Opt(nat64),
});
type MessageType = typeof Message.tsType;

const MessagePayload = Record({
  body: text,
});


const Error = Variant({
  NotFound: text,
  InvalidPayload: text,
});

// Temoorary memory storage for a message
// Will be cleared when updating wasm code
let message = "";
let tempNumber: nat64 = 0n;

// Stable memory storage for messages
// ID => Message
// Will persist across wasm updates
// 持久性存储 - 会在 wasm 更新时保留
const messagesStorage = StableBTreeMap<text, MessageType>(0);

export default Canister({
  getMessage: query([], text, () => {
    return message;
  }),

  getNumber: query([], nat64, () => {
    return tempNumber;
  }),

  // The first place is an array of input types
  // The second place is the output type
  // The third place is the parameters
  setMessageAndNumber: update([text, nat64], Void, (newMessage, input) => {
    message = newMessage; 
    tempNumber = input; 
  }),

  getStableMessages: query([], Result(Vec(Message), Error), () => {
    return Ok(messagesStorage.values());
  }),

  getStableMessage: query([text], Result(Message, Error), (id) => {
    const messageOpt = messagesStorage.get(id);
    if ("None" in messageOpt) {
      return Err({ NotFound: `the message with id=${id} not found` });
    } else {
      return Ok(messageOpt.Some);
    }
  }),

  addStableMessage: update(
    [MessagePayload],
    Result(Message, Error),
    (payload) => {
      const message: MessageType = {
        id: uuidv4(),
        createdAt: ic.time(),
        updatedAt: None,
        ...payload,
      };
      messagesStorage.insert(message.id, message);
      return Ok(message);
    }
  ),

  updateStableMessage: update(
    [text, MessagePayload],
    Result(Message, Error),
    (id, payload) => {
      const messageOpt = messagesStorage.get(id);
      if ("None" in messageOpt) {
        return Err({
          NotFound: `couldn't update a message with id=${id}. message not found`,
        });
      }
      const message = messageOpt.Some;
      const updatedMessage = {
        ...message,
        ...payload,
        updatedAt: Some(ic.time()),
      };
      messagesStorage.insert(message.id, updatedMessage);
      return Ok(updatedMessage);
    }
  ),

  deleteStableMessage: update([text], Result(Message, Error), (id) => {
    const deletedMessage = messagesStorage.remove(id);
    if ("None" in deletedMessage) {
      return Err({
        NotFound: `couldn't delete a message with id=${id}. message not found`,
      });
    }
    return Ok(deletedMessage.Some);
  }),
});
