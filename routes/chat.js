import express from "express";
import { isAuthenticated } from "../middlewares/auth.js";
import {
  addMembers,
  deleteChat,
  getChatDetails,
  getMessages,
  getMyChats,
  getMyGroups,
  leaveGroup,
  newGroupChat,
  removemember,
  renameGroup,
  sendAttachments,
} from "../controllers/chat.js";
import { attachmentsMulter } from "../middlewares/multer.js";
import {
  addMemberValidator,
  chatIdValidator,
  newGroupValidator,
  removeMemberValidator,
  renameValidator,
  sendAttachmentsValidator,
  validateHandler,
} from "../lib/validators.js";

const app = express.Router();

//alt+shift+o  :- taki sare unnecessary imports hat jaye
//esme ye dono chahiye
// app.post('/new',  singleAvatar,  newUser)
// app.post('/login', login)

//After here user must be logged in to access the route

app.use(isAuthenticated); // neeche jitne routes aayenge sare routes k liye login mangega

app.post("/new", newGroupValidator(), validateHandler, newGroupChat);
app.get("/my", getMyChats);
app.get("/my/groups", getMyGroups);
// app.put("/addmember",addMemberValidator(), validateHandler, getMyGroups)
app.put("/addmembers", addMemberValidator(), validateHandler, addMembers);
app.put(
  "/removemember",
  removeMemberValidator(),
  validateHandler,
  removemember
);

app.delete("/leave/:id", chatIdValidator(), validateHandler, leaveGroup);

//send attachment
app.post(
  "/message",
  attachmentsMulter,
  sendAttachmentsValidator(),
  validateHandler,
  sendAttachments
);

// Get Messages
app.get("/message/:id", chatIdValidator(), validateHandler, getMessages);

//Get chat details, rename, delete

app
  .route("/:id")
  .get(chatIdValidator(), validateHandler, getChatDetails)
  .put(renameValidator(), validateHandler, renameGroup)
  .delete(chatIdValidator(), validateHandler, deleteChat);
export default app;
