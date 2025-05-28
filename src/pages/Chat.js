import React, { useEffect, useState, useRef } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { encryptMessage, decryptMessage } from "../utils/crypto";

import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";

import "../styles/chat.css";

const getConversationId = (uid1, uid2) =>
  uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;

const Chat = () => {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const navigate = useNavigate();
  const chatBoxRef = useRef(null);
  const userMapRef = useRef({});

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) setUser(currentUser);
      else navigate("/login");
    });

    return () => unsubscribeAuth();
  }, [navigate]);

 useEffect(() => {
  if (!user) return;

  const userDocRef = doc(db, "users", user.uid);
  let username = "Bilinmeyen";

  const fetchUsername = async () => {
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      username = docSnap.data().username;
      userMapRef.current[user.uid] = username;
    }

    const onlineUserDocRef = doc(db, "onlineUsers", user.uid);
    await setDoc(onlineUserDocRef, {
      uid: user.uid,
      username,
      lastSeen: serverTimestamp(),
    });

    const handleUnload = async () => {
      await deleteDoc(onlineUserDocRef);
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      deleteDoc(onlineUserDocRef);
      window.removeEventListener("beforeunload", handleUnload);
    };
  };

  fetchUsername();
}, [user]);

  useEffect(() => {
    const onlineUsersRef = collection(db, "onlineUsers");

    const unsubscribe = onSnapshot(onlineUsersRef, (snapshot) => {
      const users = snapshot.docs.map((doc) => doc.data());
      setOnlineUsers(users);
    });

    return () => unsubscribe();
  }, []);

useEffect(() => {
  if (!user) return;

  let messagesRef;
  let q;

  if (selectedUser) {
    const convId = getConversationId(user.uid, selectedUser.uid);
    messagesRef = collection(db, "conversations", convId, "messages");
    q = query(messagesRef, orderBy("timestamp"));
  } else {
    messagesRef = collection(db, "messages");
    q = query(messagesRef, orderBy("timestamp"));
  }

  const unsubscribeSnapshot = onSnapshot(q, async (snapshot) => {
    const msgs = await Promise.all(
      snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        let senderUsername = userMapRef.current[data.sender];

        if (!senderUsername) {
          try {
            const userDoc = await getDoc(doc(db, "users", data.sender));
            if (userDoc.exists()) {
              senderUsername = userDoc.data().username;
              userMapRef.current[data.sender] = senderUsername;
            } else {
              senderUsername = "Bilinmeyen";
            }
          } catch (error) {
            senderUsername = "Bilinmeyen";
          }
        }

        return {
          id: docSnap.id,
          text: decryptMessage(data.text),
          sender: senderUsername,
          senderUid: data.sender,
          timestamp: data.timestamp,
        };
      })
    );

    setMessages(msgs);
    chatBoxRef.current?.scrollTo({
      top: chatBoxRef.current.scrollHeight,
      behavior: "smooth",
    });
  });

  return () => unsubscribeSnapshot();
}, [user, selectedUser]);

  const handleLogout = async () => {
    if (!user) return;

    const onlineUserDocRef = doc(db, "onlineUsers", user.uid);
    await deleteDoc(onlineUserDocRef);

    await signOut(auth);
    navigate("/login");
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (newMessage.trim() === "") return;

    try {
      const encryptedText = encryptMessage(newMessage);

      if (selectedUser) {
        const convId = getConversationId(user.uid, selectedUser.uid);
        await addDoc(collection(db, "conversations", convId, "messages"), {
          text: encryptedText,
          sender: user.uid,
          timestamp: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "messages"), {
          text: encryptedText,
          sender: user.uid,
          timestamp: serverTimestamp(),
        });
      }

      setNewMessage("");
    } catch (error) {
      alert("Mesaj gönderilirken hata oluştu: " + error.message);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h3>
          Şifreli Sohbet {selectedUser ? `- ${selectedUser.username}` : "(Genel)"}
        </h3>
        <button onClick={handleLogout} className="logout">
          Çıkış
        </button>
      </div>

      <div className="content">
        <div className="chatBox">
          <div className="messages" ref={chatBoxRef}>
            {messages.map((msg) => {
              const isSent = msg.senderUid === user.uid;
              const time = msg.timestamp?.toDate
                ? msg.timestamp.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : "";

              return (
                <div
                  key={msg.id}
                  className={`message ${isSent ? "sent" : "received"}`}
                >
                  <span className={`username ${isSent ? "sent" : "received"}`}>
                    {msg.sender}
                  </span>

                  <span className="text">{msg.text}</span>

                  <span
                    className="timestamp"
                    style={{
                      left: isSent ? "10px" : "auto",
                      right: isSent ? "auto" : "10px",
                    }}
                  >
                    {time}
                  </span>
                </div>
              );
            })}
          </div>

          <form onSubmit={handleSendMessage} className="form">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={selectedUser ? `Özel mesaj gönder...` : "Mesajınızı yazın..."}
              className="input"
            />
            <button type="submit" className="sendBtn">Gönder</button>
          </form>
        </div>

        <div className="onlineUsers">
          <h4>Aktif Kullanıcılar</h4>
          <ul>
            <li
              key="general"
              onClick={() => setSelectedUser(null)}
              className={selectedUser === null ? "active" : ""}
            >
              Genel Sohbet
            </li>
            {onlineUsers
              .filter((u) => u.uid !== user.uid)
              .map((u) => (
                <li
                  key={u.uid}
                  onClick={() => setSelectedUser(u)}
                  className={selectedUser?.uid === u.uid ? "active" : ""}
                >
                  {u.username}
                </li>
              ))}
          </ul>
        </div>
      </div>

    </div>
  );
};

export default Chat;