import { userSocketIds } from "../app.js";


//mere id se match na hoke dusre wala return kr dega
export const getOtherMember = (members, userId) =>
   members.find((member) => member._id.toString() !== userId.toString());


export const getSockets = (users = []) =>{
   const sockets = users.map((user)=> userSocketIds.get(user.toString()));

   return sockets;
};

export const getBase64 = (file) => `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;