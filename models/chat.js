import mongoose,  { Schema, model, Types} from "mongoose";

const schema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },

    groupChat: {
      type: Boolean,
      default: false,
    },

    creator: {
      type: Types.ObjectId,
      ref: "User", //given reference to userCollection
      // required: true :-  not necce as groupchat can be true or false so need of creator depends,
    },

    members: [
      {
        type: Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const Chat = mongoose.models.Chat || model("Chat", schema);
