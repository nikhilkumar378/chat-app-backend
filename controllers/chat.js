import { TryCatch } from "../middlewares/error.js";
import { ErrorHandler } from "../utils/utility.js";
import { Chat } from "../models/chat.js";

import { deleteFilesFromCloudinary, emitEvent } from "../utils/feature.js";
import { ALERT, NEW_ATTACHMENTS, NEW_MESSAGE_ALERT, REFETCH_CHATS } from "../constants/event.js";
import { getOtherMembers } from "../lib/helper.js";

import { User } from "../models/user.js";

import { Message } from "../models/message.js";

const newGroupChat = TryCatch(async (req, res, next) => {
  const { name, members } = req.body;


  //kyuki validator ban gya h dusri files me
  
  // if (members.length < 2)
  //   return next(
  //     new ErrorHandler("Group chat must have at least 3 members ", 400)
  //   );
  const allMembers = [...members, req.user];
  await Chat.create({
    name,
    groupChat: true,
    creator: req.user,
    members: allMembers,
  });

  emitEvent(req, ALERT, allMembers, `Welcome to ${name} group`);
  emitEvent(req, REFETCH_CHATS, members);

  return res.status(201).json({
    success: true,
    message: "Group Created",
  });
});

const getMyChats = TryCatch(async (req, res, next) => {
  const chats = await Chat.find({ members: req.user }).populate(
    "members",
    "name  avatar"
  );

  const transformedChats = chats.map(({ _id, name, members, groupChat }) => {
    const otherMember = getOtherMembers(members, req.user);

    return {
      _id,
      groupChat,
      avatar: groupChat
        ? members.slice(0, 3).map(({ avatar }) => avatar.url)
        : [otherMember.avatar.url],
      name: groupChat ? name : otherMember.name,
      members: members.reduce((prev, curr) => {
        if (curr._id.toString() !== req.user.toString()) {
          prev.push(curr._id);
        }
        return prev;
      }, []),
    };

    //apna id lene k liyye

    // members.filter(i=>i._id.toString() !== req.user.toString()).map(i=>i>_id)
  });

  return res.status(200).json({
    success: true,
    transformedChats,
  });
});

const getMyGroups = TryCatch(async (req, res, next) => {
  const chats = await Chat.find({
    members: req.user,
    groupChat: true,
    creator: req.user,
  }).populate("members", "name avatar");

  const groups = chats.map(({ members, _id, groupChat, name }) => ({
    _id,
    groupChat,
    name,
    avatar: members.slice(0, 3).map(({ avatar }) => avatar.url),
  }));

  return res.status(200).json({
    success: true,
    groups,
  });
});

const addMembers = TryCatch(async (req, res, next) => {
  const { chatId, members } = req.body;

  if (!members) return next(new ErrorHandler("please provide members", 400));

  const chat = await Chat.findById(chatId);

  if (!chat) return next(new ErrorHandler("Chat not found", 404));

  if (!chat.groupChat)
    return next(new ErrorHandler("This is not a group chat", 404));

  if (chat.creator.toString() !== req.user.toString())
    return next(new ErrorHandler("You are not allowed to add members", 403));

  const allNewMembersPromise = members.map((i) => User.findById(i, "name"));

  const allNewMembers = await Promise.all(allNewMembersPromise);

  const uniqueMembers = allNewMembers
    .filter((i) => !chat.members.includes(i._id.toString()))
    .map((i) => i._id);

  chat.members.push(...uniqueMembers);

  if (chat.members.length > 100)
    return next(new ErrorHandler("Group members limit reached", 400));

  await chat.save();

  const allUsersName = allNewMembers.map((i) => i.name).join(",");

  emitEvent(
    req,
    ALERT,
    chat.members,
    `${allUsersName} has been added in the group`
  );

  emitEvent(req, REFETCH_CHATS, chat.members);

  return res.status(200).json({
    success: true,
    message: "Members added successfully",
  });
});

const removemember = TryCatch(async (req, res, next) => {
  const { userId, chatId } = req.body;

  const [chat, userThatwillBeRemoved] = await Promise.all([
    Chat.findById(chatId),
    User.findById(userId, "name"),
  ]);

  if (!chat) return next(new ErrorHandler("Chat not found", 404));

  if (!chat.groupChat)
    return next(new ErrorHandler("This is not a group chat", 404));

  if (chat.creator.toString() !== req.user.toString())
    return next(new ErrorHandler("You are not allowed to add members", 403));

  if (chat.members.length <= 3)
    return next(new ErrorHandler("Group must have at least 3 members", 400));

  chat.members = chat.members.filter(
    //jiski v member ki id user ki id se match na ho wo include krte rahenge
    (members) => members.toString() !== userId.toString()
  );

  await chat.save();

  emitEvent(
    req,
    ALERT,
    chat.members,
    `${userThatwillBeRemoved.name} has been removed from the group`
  );

  emitEvent(req, REFETCH_CHATS, chat.members);

  return res.status(200).json({
    success: true,
    message: "Member removed successfully",
  });
});

const leaveGroup = TryCatch(async (req, res, next) => {
  const chatId = req.params.id;

  const chat = await Chat.findById(chatId);

  if (!chat) return next(new ErrorHandler("Chat not found", 404));

  if (!chat.groupChat)
    return next(new ErrorHandler("This is not a group chat", 400));

  //agr admin hi group chhor de

  const remainingMembers = chat.members.filter(
    (member) => member.toString() !== req.user.toString()
  );

  if (remainingMembers.length < 3)
    return next(new ErrorHandler("Group must have at least 3 members", 400));

  if (chat.creator.toString() === req.user.toString()) {
    const randomElement = Math.floor(Math.random() * remainingMembers.length);

    const newCreator = remainingMembers[randomElement];

    chat.creator = newCreator;
  }

  //esme wo sare chat member honge mere ko chhod ke
  chat.members = remainingMembers;

  //ab apna name khoj lo

  const [user] = await Promise.all([
    User.findById(req.user, "name"),
    chat.save(),
  ]);

  emitEvent(req, ALERT, chat.members, `User ${user.name} has left the group`);

  // refetch krne ki jrurt nhi h
  // emitEvent(req, REFETCH_CHATS, chat.members);

  return res.status(200).json({
    success: true,
    message: "Member removed successfully",
  });
});

const sendAttachemnts = TryCatch(async (req, res, next) => {
  const { chatId } = req.body;
  const files = req.files || [];

  if(files.length < 1) return next(new ErrorHandler("Please Upload Attachments", 400));

    if(files.length > 5) return next(new ErrorHandler("Files Can't be more than 5", 400));


  const [chat, me] = await Promise.all([
    Chat.findById(chatId),
    User.findById(req.user, "name"),
  ]);

  if (!chat) return next(new ErrorHandler("Chat not found", 404));


  if (files.length < 1)
    return next(new ErrorHandler("Please provide attachemnts", 400));

  //Uploads file here
  const attachments = [];

  const messageForDB = {
    content: "",
    attachments,
    sender: me._id,
    chat: chatId,
  };

  const messageForRealTime = {
    ...messageForDB,
    sender: {
      _id: me._id,
      name: me.name,
    },
  };

  const message = await Message.create(messageForDB);

  emitEvent(req, NEW_ATTACHMENTS, chat.members, {
    message: messageForRealTime,
    chatId,
  });

  emitEvent(req, NEW_MESSAGE_ALERT, chat.members, { chatId });

  return res.status(200).json({
    success: true,
    message,
  });
});


const getChatDetails = TryCatch(async (req,res,next)=>{
  if(req.query.populate === "true"){

    const chat = await Chat.findById(req.params.id).populate("members", "name avatar").lean();

    //lean matlb esme changes kr sakte h bina save kiye database me koi effect v nhi hoga, ab ye mogodb ka nhin javascript ka object hai

    if(!chat) return  next(new ErrorHandler("Chat not found", 404));

    chat.members = chat.members.map(({_id, name, avatar})=>({
      _id,
      name,
      avatar: avatar.url,
    }));

    return res.status(200).json({
      success: true,
      chat,
    });

  }else{

    const chat = await Chat.findById(req.params.id);
    if(!chat) return next(new ErrorHandler("Chat not found", 404));
    
    return res.status(200).json({
      success: true,
      chat
    })

  }
});

const renameGroup = TryCatch(async(req,res,next)=>{
  const chatId = req.params.id;

  const {name} = req.body;

  const chat = await Chat.findById(chatId);

  if(!chat) return next(new ErrorHandler("Chat not found", 404));

  if(!chat.groupChat) return next(new ErrorHandler("This is not a group chat", 400)); 

  if(chat.creator.toString() !== req.user.toString())
    return next(
  new ErrorHandler("You are not allowed to rename the group"));

  chat.name = name;

  await chat.save();

  emitEvent(req, REFETCH_CHATS, chat.members);

  return res.status(200).json({
    success: true,
    message : "Group renamed successfully"
  })

});


const deleteChat = TryCatch(async (req,res,next)=>{
  const chatId = req.params.id;

  const {name} = req.body;

  const chat = await Chat.findById(chatId);

  if(!chat) return next(new ErrorHandler("Chat not found", 404));

  const members  = chat.members;

  if(chat.groupChat && chat.creator.toString() !== req.user.toString()) return next(new ErrorHandler("You are not allowed to delete the group", 403)); 
 
 if(!chat.groupChat && !chat.members.includes(req.user.toString())){
  return next(
    new ErrorHandler("You are not allowed to delete the chat", 403)
  )
 }

 //Here we have to delete all messages as well as all attachments or files from cloudinary

 const messagesWithAttachments = await Message.find({
  chat: chatId,
  attachments: {$exists: true, $ne:[]},
});

const public_ids = [];

messagesWithAttachments.forEach(({attachments})=>
attachments.forEach(({public_id})=> public_ids.push(public_id))
);

 await Promise.all([
  //Delete files from cloudinary

  deleteFilesFromCloudinary(public_ids),
  chat.deleteOne(),
  Message.deleteMany({chat:chatId})
 ]);

emitEvent(req,REFETCH_CHATS, members);

return res.status(200).json({
  success: true,
  message:"Chat deleted successfully"
});

});

const getMessages = TryCatch(async(req,res,next)=>{
  const chatId = req.params.id;
  const {page = 1} = req.query;

  const resultPerPage = 20;
  const skip = (page -1) * resultPerPage;

  const [messages, totalMessagesCount] = await Promise.all([
     Message.find({chat: chatId})
  .sort({createAt: -1})
  .skip(skip)
  .limit(resultPerPage)
  .populate("sender", "name ")
  .lean(),
  Message.countDocuments({chat: chatId}),
  ])

  const totalPages = Math.ceil(totalMessagesCount / resultPerPage) || 0;

  return res.status(200).json({
    success: true,
    messages: messages.reverse(),
    totalPages
  });

});

export {
  newGroupChat,
  getMyChats,
  getMyGroups,
  addMembers,
  removemember,
  leaveGroup,
  sendAttachemnts,
  getChatDetails,
  renameGroup,
  deleteChat,
  getMessages
};
