// chat.js

const chatListEl = document.getElementById("chatList");
const messagesEl = document.getElementById("messages");
const messageInputEl = document.getElementById("messageInput");
const sidebarEl = document.getElementById("sidebar");

let chatId = 1;
let chats = [];
let messages = [];

function goBack() {
    window.history.back();
}

function toggleSidebar() {
    sidebarEl.classList.toggle("closed");
}

function createChat() {
    const newChat = {
        id: chatId++,
        title: `New chat - ${new Date().toLocaleString()}`,
        messages: []
    };
    chats.unshift(newChat);
    renderChats();
    selectChat(newChat);
}

function renderChats() {
    chatListEl.innerHTML = "";
    chats.forEach(chat => {
        const item = document.createElement("div");
        item.className = "chatItem";
        item.innerText = chat.title;
        item.onclick = () => selectChat(chat);
        chatListEl.appendChild(item);
    });
}

function selectChat(chat) {
    messages = chat.messages;
    renderMessages();
    toggleSidebar();
}

function renderMessages() {
    messagesEl.innerHTML = "";
    messages.forEach(msg => {
        const msgEl = document.createElement("div");
        msgEl.textContent = `${msg.sender}: ${msg.text}`;
        messagesEl.appendChild(msgEl);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function sendMessage() {
    const text = messageInputEl.value.trim();
    if (!text) return;

    const message = {
        sender: "You",
        text,
        timestamp: new Date()
    };

    messages.push(message);
    renderMessages();

    messageInputEl.value = "";
    messageInputEl.focus();

    setTimeout(() => {
        const botMessage = {
            sender: "Bot",
            text: `You said: ${text}`,
            timestamp: new Date()
        };
        messages.push(botMessage);
        renderMessages();
    }, 1000);
}

// Optionally preload one chat
createChat();
