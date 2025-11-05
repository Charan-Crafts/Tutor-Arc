
import React from 'react';
import { useSocket } from '../Provider/Socket';
import { useEffect } from 'react';
const Page2 = () => {

  const {socket} = useSocket();

  const handleNewuserJoined =(data)=>{

    const {email} =  data;

    console.log("Joined user email id ",email);
    
  }

  useEffect(()=>{

    socket.on('user-joined',handleNewuserJoined)
  },[socket])
  return (
    <div>
      <h1>Room page</h1>
    </div>
  );
}

export default Page2;
