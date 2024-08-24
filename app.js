import express from "express";

import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import { v4 as uuid } from "uuid";
import { errorMiddleware } from "./middlewares/error.js";
import { connectDb } from "./utils/feature.js";

import { corsOption } from "./constants/config.js";
import { getSockets } from "./lib/helper.js";
import { socketAuthenticator } from "./middlewares/auth.js";
import { Message } from "./models/message.js";
import chatRoute from "./routes/chat.js";
import userRoute from "./routes/user.js";
// import { createMessagesInAChat } from "./seeders/chat.js";
// import { createGroupChats, createSingleChats, createUser } from "./seeders/chat.js";
import { v2 as cloudinary } from "cloudinary";
import cors from "cors";
import {
  CHAT_JOINED,
  CHAT_LEAVED,
  NEW_MESSAGE,
  NEW_MESSAGE_ALERT,
  ONLINE_USERS,
  START_TYPING,
  STOP_TYPING,
} from "./constants/event.js";
import adminRoute from "./routes/admin.js";

dotenv.config({
  path: "./.env",
});

const mongouri = process.env.MONGO_URI;
const port = process.env.PORT || 3000;
const envMode = process.env.NODE_ENV.trim() || "PRODUCTION";
connectDb(mongouri);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const adminSecretKey = process.env.ADMIN_SECRET_KEY || "adsasdsdfsdfsdfd";

//esme sare currently active users h jo connected hai
const userSocketIds = new Map();
const onlineUsers = new Set();

// createSingleChats(10);
// createGroupChats(10);

// createUser(10);

// createMessagesInAChat("6679df5e1a176d4ba99509e0", 50);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: corsOption,
});

app.set("io", io);

//Using middleware here

app.use(express.json()); // json se data send krne k liye, frontend ko data bhejenge
// app.use(express.urlencoded) // form data se data send krne k liye,  frontend ko data bhejenge; ab multer use krenge
app.use(cookieParser());
app.use(cors(corsOption));

app.use("/api/v1/user", userRoute);
app.use("/api/v1/chat", chatRoute);
app.use("/api/v1/admin", adminRoute);

app.get("/", (req, res) => {
  res.send("Hello Duniya");
});

//middleware to connect only authenthtic person
io.use((socket, next) => {
  cookieParser()(
    socket.request,
    socket.request.res,
    async (err) => await socketAuthenticator(err, socket, next)
  );
});

io.on("connection", (socket) => {
  const user = socket.user;
  // console.log(user);

  userSocketIds.set(user._id.toString(), socket.id);

  // console.log(userSocketIds);

  //frontend me type krne pe ye wala functions trigger hoga, waha se emit or yaha pr listen
  socket.on(NEW_MESSAGE, async ({ chatId, members, message }) => {
    //ye real time k liye msg create kr lenge
    const messageForRealTime = {
      content: message,
      _id: uuid(),
      sender: {
        _id: user._id,
        name: user.name,
      },
      chat: chatId,
      createdAt: new Date().toISOString(),
    };

    // Ye DB me save krne k liye

    const messageForDB = {
      content: message,
      sender: user._id,
      chat: chatId,
    };

    // console.log("Emitting", members);

    //Hume frontend se mil gya msg and members v or chatId v

    //specific users ko message send krne k liye

    // upar jo msg create kara wo en neeche wale sare members ko send krna hai

    const membersSocket = getSockets(members);

    //yaha se event emit krenge jo jo us chat me rahega uske pass msg pahoch jayega, backend se emit krk frontend pr listen v kr sakte h->udher useeffect lagayenge
    io.to(membersSocket).emit(NEW_MESSAGE, {
      chatId,
      message: messageForRealTime,
    });

    //4 new messages, 5 new messages uska alert h
    io.to(membersSocket).emit(NEW_MESSAGE_ALERT, { chatId });

    try {
      await Message.create(messageForDB);
    } catch (error) {
      console.log(error);
    }
  });

  //Ab listener lagayenge typing k liye

  socket.on(START_TYPING, ({ members, chatId }) => {
    // console.log(" start - typing", chatId);

    const membersSockets = getSockets(members);
    //emit kro upar se userid leke
    socket.to(membersSockets).emit(START_TYPING, { chatId });
  });

  socket.on(STOP_TYPING, ({ members, chatId }) => {
    // console.log(" start -typing", chatId);

    const membersSockets = getSockets(members);
    //emit kro upar se userid leke
    socket.to(membersSockets).emit(STOP_TYPING, { chatId });
  });

  socket.on(CHAT_JOINED, ({ userId, members }) => {
    //onlineusers wale set me add kr di user ki id
    onlineUsers.add(userId.toString());

    const membersSocket = getSockets(members);
    //fronted pe ek listner laga jise onlineusers mile hume
    io.to(membersSocket).emit(ONLINE_USERS, Array.from(onlineUsers));
  });
  socket.on(CHAT_LEAVED, ({ userId, members }) => {
    onlineUsers.delete(userId.toString());
    const membersSocket = getSockets(members);
    io.to(membersSocket).emit(ONLINE_USERS, Array.from(onlineUsers));
  });

  socket.on("disconnect", () => {
    // console.log("user disconnected");

    userSocketIds.delete(user._id.toString());
    onlineUsers.delete(user._id.toString());
    socket.broadcast.emit(ONLINE_USERS, Array.from(onlineUsers));
  });
});

app.use(errorMiddleware);

server.listen(port, () => {
  console.log(`Server is running on port ${port} in ${envMode} Mode`);
});

export { adminSecretKey, envMode, userSocketIds };
