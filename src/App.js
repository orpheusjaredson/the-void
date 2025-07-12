import React, { useEffect, useRef, useState } from "react";
import { db } from "./firebase";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc } from "firebase/firestore";

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function getSeed(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

function randomBetween(a, b) {
  return a + Math.random() * (b - a);
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [scattered, setScattered] = useState([]); // Scattered messages for the void
  const [cameraOffset, setCameraOffset] = useState(0); // Virtual camera offset
  const [messageArrivalTimes, setMessageArrivalTimes] = useState({}); // Track when each message was first seen
  const sessionStartRef = useRef(Date.now()); // Track when the user opened the site
  const [scatterTimes, setScatterTimes] = useState({}); // Track when each message should become scattered
  const prevWidthRef = useRef(window.innerWidth);
  const animationRef = useRef();
  const containerRef = useRef();
  const SCATTER_HEIGHT = viewport.height * 10; // Tall virtual area
  const SPAWN_COUNT = 40; // Number of times to spawn each message
  const ANIMATION_SPEED = 60; // px/sec
  const MESSAGE_DELAY = 2000; // ms (2 seconds)
  // Remove pendingDeleteIds state and all related effects

  function estimateTextHeight(text) {
    const words = text.split(' ');
    const lines = Math.ceil(words.length / 8);
    return lines * fontSize * 16 * 1.2;
  }
  function isOverlapping(a, b) {
    const cushion = 40; // px safe cushion around each message
    return (
      a.x - cushion < b.x + b.width + cushion &&
      a.x + a.width + cushion > b.x - cushion &&
      a.y - cushion < b.y + b.height + cushion &&
      a.y + a.height + cushion > b.y - cushion
    );
  }

  // Firestore listener
  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const msgs = [];
      querySnapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() });
      });
      setMessages(msgs);
      // Track arrival times for new messages
      setMessageArrivalTimes((prev) => {
        const now = Date.now();
        const updated = { ...prev };
        msgs.forEach((msg) => {
          if (!updated[msg.id]) {
            updated[msg.id] = now;
          }
        });
        // Clean up old message IDs
        Object.keys(updated).forEach((id) => {
          if (!msgs.find((m) => m.id === id)) {
            delete updated[id];
          }
        });
        return updated;
      });
    });
    return unsubscribe;
  }, []);

  // Update viewport size on resize and re-scatter messages
  useEffect(() => {
    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Scatter messages in a tall area
  useEffect(() => {
    if (!messages.length) return;
    const fontSize = 1.3; // Fixed font size for all messages
    const maxWidth = 260; // Fixed width for all messages
    const placed = [];
    let nextId = 0;
    function estimateTextHeight(text) {
      const words = text.split(' ');
      const lines = Math.ceil(words.length / 8);
      return lines * fontSize * 16 * 1.2;
    }
    function isOverlapping(a, b) {
      const cushion = 40; // px safe cushion around each message
      return (
        a.x - cushion < b.x + b.width + cushion &&
        a.x + a.width + cushion > b.x - cushion &&
        a.y - cushion < b.y + b.height + cushion &&
        a.y + a.height + cushion > b.y - cushion
      );
    }
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const height = estimateTextHeight(msg.text);
      const width = maxWidth;
      for (let spawn = 0; spawn < SPAWN_COUNT; spawn++) {
        const baseSeed = getSeed(msg.text) + spawn * 100000;
        let x, y, tries = 0, overlap;
        do {
          const trySeed = baseSeed + tries * 1000;
          x = seededRandom(trySeed) * (viewport.width - width);
          y = seededRandom(trySeed + 100) * (SCATTER_HEIGHT - height);
          const candidate = { x, y, width, height };
          overlap = placed.some(other => isOverlapping(candidate, other));
          tries++;
        } while (overlap && tries < 50);
        // Only render if in the visible void
        if (y + height > 0 && y < SCATTER_HEIGHT) {
          placed.push({
            id: `scattered-${nextId++}`,
            text: msg.text,
            x,
            y,
            fontSize,
            width,
            height,
          });
        }
      }
    }
    setScattered(placed);
    // eslint-disable-next-line
  }, [messages, viewport.width, viewport.height, cameraOffset, messageArrivalTimes]);

  // Animation: cameraOffset increases over time
  useEffect(() => {
    let last = Date.now();
    let running = true;
    function animate() {
      if (!running) return;
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      setCameraOffset((prev) => prev + ANIMATION_SPEED * dt);
      animationRef.current = requestAnimationFrame(animate);
    }
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      running = false;
      cancelAnimationFrame(animationRef.current);
    };
  }, [SCATTER_HEIGHT]);

  // Mouse wheel: update cameraOffset
  useEffect(() => {
    const handleWheel = (e) => {
      setCameraOffset((prev) => prev + e.deltaY);
    };
    const container = containerRef.current;
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: false });
    }
    return () => {
      if (container) container.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const sendMessage = async (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    await addDoc(collection(db, "messages"), {
      text: trimmed,
      timestamp: serverTimestamp(),
    });
    setInput("");
  };

  // Wrap cameraOffset to keep it in range (for numerical stability)
  const wrappedCameraOffset = ((cameraOffset % SCATTER_HEIGHT) + SCATTER_HEIGHT) % SCATTER_HEIGHT;

  // Only render messages in the visible viewport for performance
  const visibleMessages = scattered.filter((msg) => {
    let y = msg.y - wrappedCameraOffset;
    if (y < -msg.height) y += SCATTER_HEIGHT;
    if (y > SCATTER_HEIGHT - msg.height) y -= SCATTER_HEIGHT;
    return y + msg.height > 0 && y < viewport.height;
  });

  function splitIntoBalancedLines(text, targetLength = 48) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    for (let word of words) {
      if ((currentLine + ' ' + word).trim().length > targetLength && currentLine.length > 0) {
        lines.push(currentLine.trim());
        currentLine = word;
      } else {
        currentLine += ' ' + word;
      }
    }
    if (currentLine.trim().length > 0) lines.push(currentLine.trim());
    return lines;
  }

  return (
    <div className="flex flex-col h-screen bg-black text-white">
      {/* Bold centered title at the top */}
      <div
        style={{
          width: "100%",
          textAlign: "center",
          fontWeight: "bold",
          fontSize: "2.5rem",
          letterSpacing: "0.2em",
          padding: "1.2rem 0 0.5rem 0",
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "rgba(0,0,0,0.85)",
        }}
      >
        THE VOID
      </div>
      <div
        ref={containerRef}
        className="flex-1 relative"
        style={{
          width: "100%",
          height: "100%",
          minHeight: 0,
          background: "black",
          overflow: "hidden",
          position: "relative",
        }}
        tabIndex={0}
      >
        {/* Message rendering code follows */}
        {visibleMessages.map((msg) => {
          let y = msg.y - wrappedCameraOffset;
          if (y < -msg.height) y += SCATTER_HEIGHT;
          if (y > SCATTER_HEIGHT - msg.height) y -= SCATTER_HEIGHT;

          // Split message into visually balanced lines by character count
          const lines = splitIntoBalancedLines(msg.text, 48);

          return (
            <div
              key={msg.id}
              style={{
                position: "absolute",
                left: msg.x,
                top: y,
                fontSize: `${msg.fontSize}em`,
                color: "white",
                maxWidth: msg.width,
                wordBreak: "break-word",
                pointerEvents: "auto",
                userSelect: "text",
                fontWeight: 400,
                opacity: 0.95,
                lineHeight: 1.2,
                transition: "none",
              }}
            >
              {lines.map((line, idx) => (
                <span key={idx}>
                  {line}
                  {idx < lines.length - 1 && <br />}
                </span>
              ))}
            </div>
          );
        })}
      </div>
      <form
        onSubmit={sendMessage}
        className="w-full flex items-center px-4 py-3 border-t border-gray-800 bg-black"
        autoComplete="off"
        style={{ position: "sticky", bottom: 0, zIndex: 10 }}
      >
        <input
          className="flex-1 bg-transparent border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-white placeholder-gray-500"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Speak into the void..."
          autoFocus
        />
        <button
          type="submit"
          className="ml-3 px-4 py-2 border-2 border-white bg-black text-white rounded transition hover:bg-white hover:text-black"
        >
          Send
        </button>
      </form>
    </div>
  );
}