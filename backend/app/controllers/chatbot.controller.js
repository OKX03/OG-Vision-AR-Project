const db = require("../models");
const ChatSession = db.chat_session;
const ChatMessage = db.chat_message;
const FAQ = db.faq;
const Product = db.product;
const { Op } = require("sequelize");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const tools = [
  {
    functionDeclarations: [
      {
        name: "search_faq",
        description: "Search the FAQ database. Extract the core concepts or keywords from the user's question.",
        parameters: {
          type: "OBJECT",
          properties: {
            keywords: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "An array of 1 to 3 broad keywords. If the user asks about 'S, M, L, XL', extract the keyword 'size'. Do not use full sentences or single letters."
            }
          },
          required: ["keywords"]
        }
      },
      {
        name: "recommend_products",
        description: "Recommend products from the database based on user preferences.",
        parameters: {
          type: "OBJECT",
          properties: {
            frame_shape: { type: "STRING" },
            frame_material: { type: "STRING" },
            gender: { type: "STRING" },
            face_shape: { type: "STRING" },
            color: { type: "STRING" },
            brand: { type: "STRING" }
          }
        }
      }
    ]
  }
];

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  tools: tools,
  systemInstruction: "You are a helpful eyewear assistant for OG Vision AR. Always try to use the search_faq tool before giving up on a question. If asked about S, M, L, or XL, the user is asking about frame sizes. When recommending products using the recommend_products tool, do NOT list the products in your text response. A UI component will display them automatically based on the function result. Just acknowledge finding them and provide a brief friendly message.",
});

exports.createSession = async (req, res) => {
  try {
    const user_id = req.userId;
    const session = await ChatSession.create({ user_id });

    const greetingMsg = await ChatMessage.create({
      session_id: session.session_id,
      sender: "model",
      content: "Hi there! Welcome to OG Vision AR.\n\nYou can ask general questions, or I can help you find a frame that suits your face and style.\nJust tell me what you're looking for — frame shape, color, face type, or brand!",
    });

    res.status(200).send({
      session_id: session.session_id,
      messages: [greetingMsg]
    });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.getSessionHistory = async (req, res) => {
  try {
    const { session_id } = req.params;
    const messages = await ChatMessage.findAll({
      where: { session_id },
      order: [['send_at', 'ASC']]
    });

    res.status(200).send(messages);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { session_id, message } = req.body;
    const user_id = req.userId;

    if (!session_id || !message) {
      return res.status(400).send({ message: "session_id and message are required." });
    }

    const session = await ChatSession.findOne({ where: { session_id, user_id } });
    if (!session) {
      return res.status(404).send({ message: "Session not found." });
    }

    let dbHistory = await ChatMessage.findAll({
      where: { session_id },
      order: [['send_at', 'DESC']],
      limit: 10
    });
    
    dbHistory = dbHistory.reverse();

    const history = [];
    let expectedRole = 'user';

    dbHistory.forEach(msg => {
      if (msg.sender === 'function') return;

      const role = msg.sender === 'model' ? 'model' : 'user';

      if (role === expectedRole) {
        history.push({ role: role, parts: [{ text: msg.content }] });
        expectedRole = role === 'user' ? 'model' : 'user';
      }
    });

    if (history.length > 0 && history[history.length - 1].role === 'user') {
      history.pop();
    }

    await ChatMessage.create({
      session_id,
      sender: "user",
      content: message
    });

    const chat = model.startChat({ history });
    let result = await chat.sendMessage(message);
    const response = result.response;
    const functionCalls = response.functionCalls();
    
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      const intent = call.name;
      const args = call.args;
      let apiResponse = null;

      if (intent === "search_faq") {
        const keywords = args.keywords || [];
        
        if (keywords.length === 0) {
          apiResponse = [];
        } else {
          const searchConditions = keywords.map(kw => ({
            [Op.or]: [
              { question: { [Op.like]: `%${kw}%` } },
              { answer: { [Op.like]: `%${kw}%` } },
              { category: { [Op.like]: `%${kw}%` } }
            ]
          }));

          const faqs = await FAQ.findAll({
            where: { [Op.or]: searchConditions },
            limit: 5
          });
          
          apiResponse = faqs.map(f => ({ question: f.question, answer: f.answer }));
        }

      } else if (intent === "recommend_products") {
        const whereClause = {};
        if (args.frame_shape) whereClause.frame_shape = { [Op.like]: `%${args.frame_shape}%` };
        if (args.frame_material) whereClause.frame_material = { [Op.like]: `%${args.frame_material}%` };
        if (args.gender) whereClause.gender = args.gender;
        if (args.color) whereClause.color = { [Op.like]: `%${args.color}%` };
        if (args.brand) whereClause.brand = { [Op.like]: `%${args.brand}%` };
        if (args.face_shape) whereClause.face_shape = { [Op.like]: `%${args.face_shape}%` };

        const products = await Product.findAll({
          where: whereClause,
          limit: 5
        });

        apiResponse = products.map(p => ({
          product_id: p.product_id,
          brand: p.brand,
          model: p.model,
          price: p.price,
          description: p.description
        }));
      }

      await ChatMessage.create({
        session_id,
        sender: "function",
        intent: intent,
        entities: JSON.stringify(args)
      });

      result = await chat.sendMessage([{
        functionResponse: {
          name: intent,
          response: { result: apiResponse }
        }
      }]);

      const finalResponse = result.response;
      let replyText = finalResponse.text();
      
      if (intent === "recommend_products" && apiResponse && apiResponse.length > 0) {
        replyText += `\n\n__PRODUCTS__${JSON.stringify(apiResponse)}__PRODUCTS__`;
      }
      
      await ChatMessage.create({
        session_id,
        sender: "model",
        content: replyText
      });

      const finalMsg = await ChatMessage.findOne({
        where: { session_id },
        order: [['send_at', 'DESC']]
      });

      return res.status(200).send(finalMsg);
    } else {
      const replyMsg = await ChatMessage.create({
        session_id,
        sender: "model",
        content: response.text()
      });

      return res.status(200).send(replyMsg);
    }
  } catch (err) {
    if (err.status === 429) {
      const currentSessionId = req.body?.session_id || "unknown"; 
      return res.status(200).send({
        session_id: currentSessionId,
        sender: "model",
        content: "I am receiving a high volume of requests right now. Please wait a moment and try asking your question again!"
      });
    }
    res.status(500).send({ message: "An error occurred while communicating with the AI chatbot." });
  }
};

exports.endSession = async (req, res) => {
  try {
    const { session_id } = req.params;
    const user_id = req.userId;

    const session = await ChatSession.findOne({ where: { session_id, user_id } });
    if (!session) {
      return res.status(404).send({ message: "Session not found." });
    }

    session.end_time = new Date();
    await session.save();

    res.status(200).send({ message: "Chat session ended successfully." });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};