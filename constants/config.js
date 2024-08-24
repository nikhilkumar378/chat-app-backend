const corsOption = {
  
    origin: [
      "http://localhost:5173", "http://localhost:4173",
      process.env.CLIENT_URL
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  
}

const CHATTU_TOKEN = "chattu";

export {corsOption, CHATTU_TOKEN};