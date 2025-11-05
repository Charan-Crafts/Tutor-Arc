import React from 'react';
import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Room from './pages/Room';
import TeacherLogin from './pages/TeacherLogin';
import StudentLogin from './pages/StudentLogin';
import TeacherSignup from './pages/TeacherSignup';
import StudentSignup from './pages/StudentSignup';
import Teacher from './pages/Teacher';
import Student from './pages/Student';
import { SocketProvider } from './Provider/Socket';
const App = () => {
  return (
    <div>
      <SocketProvider>
        <Routes>
          <Route path='/' element={<Home />} />
          <Route path='/teacher-login' element={<TeacherLogin />} />
          <Route path='/student-login' element={<StudentLogin />} />
          <Route path='/teacher-signup' element={<TeacherSignup />} />
          <Route path='/student-signup' element={<StudentSignup />} />
          <Route path='/teacher' element={<Teacher />} />
          <Route path='/student' element={<Student />} />
          <Route path='/room/:roomId' element={<Room />}></Route>
        </Routes>
      </SocketProvider>
    </div>
  );
}

export default App;
