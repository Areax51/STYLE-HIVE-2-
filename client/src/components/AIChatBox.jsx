import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import TypingDots from "./TypingDots";
import { Heart, Tag } from "lucide-react";

const socket = io(import.meta.env.VITE_SOCKET_URL, {
  transports: ["websocket"],
});

const AIChatBox = () => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [products, setProducts] = useState([]);
  const [currentStream, setCurrentStream] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const token = localStorage.getItem("token");

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentStream]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [chatRes, productRes] = await Promise.all([
          axios.get(`${import.meta.env.VITE_API_URL}/chat/history`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${import.meta.env.VITE_API_URL}/products`),
        ]);
        setMessages(chatRes.data.reverse());
        setProducts(productRes.data);
      } catch (err) {
        console.error("Error loading data", err.message);
      }
    };
    fetchData();
  }, [token]);

  useEffect(() => {
    socket.on("aiReplyChunk", (chunk) => {
      setCurrentStream((prev) => prev + chunk);
    });

    socket.on("aiReplyComplete", (fullReply) => {
      setLoading(false);
      const lastUserMsg = messages[messages.length - 1];
      const newChat = {
        ...lastUserMsg,
        response: fullReply,
        liked: false,
        tags: [], // will be updated later if needed
      };
      setMessages((prev) => [...prev.slice(0, -1), newChat]);
      setCurrentStream("");
    });

    socket.on("aiReplyError", (err) => {
      console.error("AI Error:", err);
      setLoading(false);
      setCurrentStream("");
    });

    return () => {
      socket.off("aiReplyChunk");
      socket.off("aiReplyComplete");
      socket.off("aiReplyError");
    };
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    const newMsg = { prompt: input, response: null, liked: false };
    setMessages((prev) => [...prev, newMsg]);
    setInput("");
    setCurrentStream("");
    setLoading(true);

    socket.emit("userMessage", {
      message: input,
      token,
    });
  };

  const toggleLike = async (chatId, liked) => {
    try {
      await axios.patch(
        `${import.meta.env.VITE_API_URL}/chat/${chatId}`,
        { liked: !liked },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === chatId ? { ...msg, liked: !liked } : msg
        )
      );
    } catch (err) {
      console.error("Failed to like chat", err.message);
    }
  };

  const getProductFromResponse = (text) => {
    return products.find((p) =>
      text.toLowerCase().includes(p.name.toLowerCase())
    );
  };

  return (
    <div className="w-full max-w-4xl h-[80vh] mx-auto bg-black text-white rounded-2xl shadow-gold border border-gold p-4 sm:p-6 flex flex-col">
      <div className="flex-1 overflow-y-auto space-y-6 mb-4 pr-2 scrollbar-thin scrollbar-thumb-gold scrollbar-track-gray-800">
        {messages.map((msg, i) => {
          const product = msg.response && getProductFromResponse(msg.response);
          return (
            <div key={i} className="space-y-2">
              <div>
                <p className="text-gold font-bold">You:</p>
                <p>{msg.prompt}</p>
              </div>
              {msg.response && (
                <div className="bg-white/10 p-4 rounded-xl border border-gold">
                  <div className="flex justify-between items-start gap-4">
                    <div className="text-white space-y-2 flex-1">
                      <p className="text-gold font-bold">StyleHive AI:</p>
                      <p>{msg.response}</p>

                      {/* 🏷️ Tags */}
                      {msg.tags && msg.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {msg.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-1 bg-yellow-600/20 text-yellow-300 text-xs font-semibold rounded-full"
                            >
                              <Tag size={12} className="mr-1" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* 🛍️ Product Preview */}
                      {product && (
                        <div className="mt-3 border border-gold rounded-xl overflow-hidden flex flex-col sm:flex-row">
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full sm:w-40 h-40 object-cover"
                          />
                          <div className="p-4">
                            <h3 className="text-lg font-bold text-gold">
                              {product.name}
                            </h3>
                            <p className="text-sm">${product.price}</p>
                            <a
                              href={`/product/${product._id}`}
                              className="text-yellow-400 hover:underline text-sm mt-2 block"
                            >
                              View product
                            </a>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ❤️ Like */}
                    {msg._id && (
                      <Heart
                        className={`cursor-pointer text-gold hover:scale-110 transition ${
                          msg.liked ? "fill-gold" : ""
                        }`}
                        onClick={() => toggleLike(msg._id, msg.liked)}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="bg-white/10 p-4 rounded-xl border border-gold">
            <p className="text-gold font-bold">StyleHive AI:</p>
            <p className="italic text-gray-300">{currentStream}</p>
            <TypingDots />
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Ask about a look, outfit, or product..."
          className="flex-1 p-3 rounded-lg bg-gray-800 border border-gold text-white focus:outline-none"
        />
        <button
          onClick={sendMessage}
          className="px-5 py-2 bg-gold text-black font-bold rounded-lg hover:bg-yellow-400 transition"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default AIChatBox;
