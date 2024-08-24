const corsOption = {
  
    origin: [
     "https://chat-app-backend-7.onrender.com",
     
      process.env.CLIENT_URL
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  
}

const CHATTU_TOKEN = "chattu";

export {corsOption, CHATTU_TOKEN};
