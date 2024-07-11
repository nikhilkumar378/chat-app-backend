import express from "express";

import { connectDb } from "./utils/feature.js";
import dotenv from "dotenv";
import { errorMiddleware } from "./middlewares/error.js";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";
import { createServer } from "http";
import { v4 as uuid } from "uuid";

import userRoute from "./routes/user.js";
import chatRoute from "./routes/chat.js";
// import { createMessagesInAChat } from "./seeders/chat.js";
// import { createGroupChats, createSingleChats, createUser } from "./seeders/chat.js";
import adminRoute from "./routes/admin.js";
import { NEW_MESSAGE, NEW_MESSAGE_ALERT } from "./constants/event.js";
import { getSockets } from "./lib/helper.js";
import { Message } from "./models/message.js";
import cors from 'cors';
import {v2 as cloudinary} from "cloudinary";

dotenv.config({
  path: "./.env",
});

const mongoURI = process.env.MONGO_URI;
const port = process.env.PORT || 3000;
const envMode = process.env.NODE_ENV.trim() || "PRODUCTION";
connectDb(mongoURI);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET, 
})

const adminSecretKey = process.env.ADMIN_SECRET_KEY || "6packprogrammer";

//esme sare currently active users h jo connected hai
const userSocketIds = new Map();

// createSingleChats(10);
// createGroupChats(10);

// createUser(10);

// createMessagesInAChat("6679df5e1a176d4ba99509e0", 50);

const app = express();
const server = createServer(app);
const io = new Server(server, {});

//Using middleware here

app.use(express.json()); // json se data send krne k liye, frontend ko data bhejenge
// app.use(express.urlencoded) // form data se data send krne k liye,  frontend ko data bhejenge; ab multer use krenge
app.use(cookieParser());
app.use(
  cors({
    origin: [
      "http://localhost:5173", "http://localhost:4173",
      process.env.CLIENT_URL
    ],
    credentials: true,
  }))

app.use("/api/v1/user", userRoute);
app.use("/api/v1/chat", chatRoute);
app.use("/api/v1/admin", adminRoute);

app.get("/", (req, res) => {
  res.send("Hello Duniya");
});

io.use((socket, next)=>{});

io.on("connection", (socket) => {
  const user = {
    _id: "asdsda",
    name: "asdsda",
  };

  userSocketIds.set(user._id.toString(), socket.id);

  console.log(userSocketIds);

  //frontend me type krne pe ye wala functions trigger hoga
  socket.on(NEW_MESSAGE, async (chatId, members, message) => {
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

    //Hume frontend se mil gya msg and members v or chatId v

    //specific users ko message send krne k liye

    // upar jo msg create kara wo en neeche wale sare members ko send krna hai

    const membersSocket = getSockets(members);

    //yaha se event emit krenge jo jo us chat me rahega uske pass msg pahoch jayega
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

  socket.on("disconnect", () => {
    console.log("user disconnected");

    userSocketIds.delete(user._id.toString());
  });
});

app.use(errorMiddleware);

server.listen(port, () => {
  console.log(`Server is running on port ${port} in ${envMode} Mode`);
});

export { envMode, adminSecretKey, userSocketIds };
