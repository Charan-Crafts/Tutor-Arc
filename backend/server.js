const express = require("express")

const {Server} = require("socket.io")


const bodyParser = require("body-parser")

// Socket server
const io = new Server(
    {
        cors:true
    }
);

// webserver

const app = express()

app.use(bodyParser.json())

const emailToSocketMapping = new Map();

io.on('connection',(socket) =>{

    // to join the room we required the email and roomId from the frontend
    socket.on("join-room",(data)=>{

        const {email,roomId} =  data


        console.log( "User is joined in the room with email ",email," and room id ",roomId);
        

        emailToSocketMapping.set(email,socket.id)

        socket.join(roomId)

        socket.emit("joined-room",{roomId})

        // Hey user is joined with this email
        socket.broadcast.to(roomId).emit("User-joined",{email})
    })

})

app.listen(3000,()=>console.log(`Server is running at port 3000`)
)


// Socket server is running at port 8000
io.listen(8000)