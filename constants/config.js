const corsOption = {
  
    origin: [
   "https://chat-app-frontend-fawn.vercel.app/",
     
      process.env.CLIENT_URL
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  
}

const CHATTU_TOKEN = "chattu";

export {corsOption, CHATTU_TOKEN};
