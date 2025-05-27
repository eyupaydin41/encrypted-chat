import React, { useEffect, useState, useRef } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";

import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

import "../styles/chat.css";

const Chat = () => {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const navigate = useNavigate();

  const chatBoxRef = useRef(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) setUser(currentUser);
      else navigate("/login");
    });

    return () => unsubscribeAuth();
  }, [navigate]);

  useEffect(() => {
    if (!user) return;

    const messagesRef = collection(db, "messages");
    const q = query(messagesRef, orderBy("timestamp"));

    const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMessages(msgs);
      chatBoxRef.current?.scrollTo({ top: chatBoxRef.current.scrollHeight, behavior: "smooth" });
    });

    return () => unsubscribeSnapshot();
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (newMessage.trim() === "") return;

    try {
      await addDoc(collection(db, "messages"), {
        text: newMessage,
        sender: user.email,
        timestamp: serverTimestamp(),
      });

      setNewMessage("");
    } catch (error) {
      alert("Mesaj gönderilirken hata oluştu: " + error.message);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h3>Şifreli Sohbet</h3>
        <button onClick={handleLogout} className="logout">
          Çıkış
        </button>
      </div>

      <div className="chatBox" ref={chatBoxRef}>
        {messages.map((msg) => (
          <div key={msg.id} className="message">
            <strong>{msg.sender}:</strong> {msg.text}{" "}
            <span className="time">
              {msg.timestamp?.toDate
                ? msg.timestamp.toDate().toLocaleTimeString()
                : ""}
            </span>
          </div>
        ))}
      </div>

      <form onSubmit={handleSendMessage} className="form">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Mesajınızı yazın..."
          className="input"
        />
        <button type="submit" className="sendBtn">
          Gönder
        </button>
      </form>
    </div>
  );
};

export default Chat;
