const db = require("../models");
const ChatSession = db.chat_session;
const ChatMessage = db.chat_message;
const FAQ = db.faq;
const Product = db.product;
const User = db.user;
const ProductImage = db.product_image; 
const Op = db.Sequelize.Op;
const { GoogleGenerativeAI } = require("@google/generative-ai");
const namer = require("color-namer");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Color Matching
const baseColors = {
  black: [0, 0, 0], white: [255, 255, 255],
  red: [255, 0, 0], green: [0, 128, 0],
  blue: [0, 0, 255], yellow: [255, 255, 0],
  grey: [128, 128, 128], gray: [128, 128, 128],
  brown: [165, 42, 42], gold: [255, 215, 0],
  silver: [192, 192, 192], pink: [255, 192, 203],
  purple: [128, 0, 128], orange: [255, 165, 0],
  navy: [0, 0, 128],
  dark: [30, 30, 30], charcoal: [54, 69, 79],
  clear: [255, 255, 255], transparent: [255, 255, 255],
  tortoise: [150, 75, 0], light: [220, 220, 220]
};

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : null;
}

function getColorDistance(rgb1, rgb2) {
  return Math.sqrt(
    Math.pow(rgb1[0] - rgb2[0], 2) + Math.pow(rgb1[1] - rgb2[1], 2) + Math.pow(rgb1[2] - rgb2[2], 2)
  );
}

// FAQ Tool for extracting keywords
const faqTool = {
  name: "search_faq",
  description: "Search the FAQ database. Extract 1 to 3 CORE nouns from the user's query.",
  parameters: {
    type: "OBJECT",
    properties: {
      keywords: {
        type: "ARRAY",
        items: { type: "STRING" },
        description: "Array of distinct core nouns."
      }
    },
    required: ["keywords"]
  }
};

// Product Recommendation Tool for extracting preferences
const productTool = {
  name: "recommend_products",
  description: "Recommend products from the database based on user preferences. DO NOT include generic words like 'frame', 'glasses', or 'pair'.",
  parameters: {
    type: "OBJECT",
    properties: {
      is_new_search: { type: "BOOLEAN", description: "Set to true ONLY if the user is starting a completely new and unrelated search. Set to false if they are refining, adding to, or modifying the current ongoing search." },
      frame_shape: { type: "STRING", description: "e.g., Round, Square, Rectangle, Wayfarer, Browline" },
      frame_material: { type: "STRING", description: "e.g., Metal, Plastic, Acetate" },
      gender: { type: "STRING" },
      face_shape: { type: "STRING", description: "e.g., Oval, Round, Square, Heart, Oblong" },
      color: { type: "STRING" },
      brand: { type: "STRING" },
      frame_size: { type: "STRING", description: "e.g., Small, Medium, Large, Extra Large" },
      max_price: { type: "NUMBER", description: "The maximum price budget if the user specifies one." }
    }
  }
};

// Classification Router Model to determine intent (FAQ/PRODUCT/GENERAL)
const routerModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-lite",
  systemInstruction: `You are an intent classifier for an eyewear store. Analyze the user's message and output EXACTLY ONE WORD from this list: 'FAQ', 'PRODUCT', or 'GENERAL'.

CLASSIFICATION RULES:
1. 'PRODUCT': The user is looking for SPECIFIC physical items based on attributes. 
   - CRITICAL RULE: If the user is answering a follow-up question about their preferences with short phrases (e.g., replying "black", "round", "for men", "under 200", "any", "no preference", "doesn't matter"), you MUST classify it as PRODUCT.
2. 'FAQ': The user is asking about store policies, procedures, technical help, or definitions (pay, buy, online booking, webcam, camera, size meaning).
3. 'GENERAL': Simple greetings, farewells, or completely off-topic conversations.

Examples:
[PRODUCT]
- "I want round metal frames"
- "black"
- "any shape is fine"

[FAQ]
- "How do I pay for my glasses?" 
- "My webcam isn't turning on for the try-on"
- "What does size 54 mean?"

[GENERAL]
- "Good morning"
- "Thanks, that's all I needed" 
- "What is the weather like today?"`
});

// FAQ Model with access to the FAQ tool
const faqModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  tools: [{ functionDeclarations: [faqTool] }],
  systemInstruction: "You are an eyewear customer support expert. ALWAYS use the search_faq tool to extract keywords from user inquiries."
});

// Product Recommendation Model with access to the product recommendation tool
const productModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  tools: [{ functionDeclarations: [productTool] }],
  systemInstruction: `You are an eyewear recommendation expert. Your ONLY task is to extract product preferences from the user's message and IMMEDIATELY call the 'recommend_products' tool.

CRITICAL RULES:
1. ALWAYS call the 'recommend_products' tool in EVERY turn.
2. DO NOT ask the user any questions yourself. The system will handle asking the user for more details if the search results are too broad.
3. ONLY extract preferences mentioned in the CURRENT user message. DO NOT try to remember previous preferences; the system will automatically merge them for you.
4. If the user asks to change a preference (e.g. "change gold to black"), output the new value for that category.
5. If the user is starting a completely new search (e.g. asking for a totally different frame from scratch), set 'is_new_search' to true. Otherwise, set it to false.
6. Once you trigger the tool, DO NOT generate any additional conversational text.`
});

// General Model for everything else
const generalModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-lite",
  systemInstruction: "You are a friendly eyewear assistant for OG Vision AR. Greet the user nicely, ask how you can help them find glasses, and provide a quick tip or example on how they can state their preferences (e.g., 'Tip: You can try asking for black metal frames, or round glasses for men'). Politely decline off-topic requests. Do not use any external tools."
});

// Summary Model for condensing FAQ search results into a user-friendly answer
const summaryModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash"
});

exports.createSession = async (req, res) => {
  try {
    const user_id = req.userId;
    const session = await ChatSession.create({ user_id });

    let profileContext = "the gender and face shape saved in your profile";
    if (user_id) {
      try {
        const user = await User.findByPk(user_id);
        if (user) {
          const hasGender = user.gender && user.gender.trim() !== "";
          const hasFaceShape = user.face_shape && user.face_shape.trim() !== "";
          
          if (hasGender && hasFaceShape) {
            profileContext = `your saved gender (${user.gender}) and face shape (${user.face_shape})`;
          } else if (hasGender) {
            profileContext = `your saved gender (${user.gender})`;
          } else if (hasFaceShape) {
            profileContext = `your saved face shape (${user.face_shape})`;
          }
        }
      } catch(e) { console.error("Error fetching user for greeting:", e); }
    }

    const greetingMsg = await ChatMessage.create({
      session_id: session.session_id,
      sender: "model",
      content: `Hello there! Welcome to OG Vision AR. I'm your AI eyewear assistant, here to help you find the perfect pair of glasses, answer questions about our store, and guide you through our products.\n\n💡 *Tip: To help me find your ideal frames faster, you can share specific preferences. I can filter by:*\n• **Shape:** Frame Shape (e.g., Round, Square) & Face Shape (e.g., Oval, Heart)\n• **Design:** Color, Material (e.g., Metal, Acetate), & Brand\n• **Fit & Budget:** Size (e.g., Medium, Large) & Maximum Price (e.g., Under RM200)\n• **Gender:** Men, Women, or Unisex\n\nNote: I will automatically personalize recommendations based on ${profileContext}, but you can always ask to see other styles!\n\n**Give it a try!** You can say something like: 'Show me black metal round frames under RM300.'`
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
      order: [['message_id', 'ASC']]
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

    console.log(`USER MESSAGE: "${message}"`);

    if (!session_id || !message) {
      return res.status(400).send({ message: "session_id and message are required." });
    }

    const session = await ChatSession.findOne({ where: { session_id, user_id } });
    if (!session) {
      return res.status(404).send({ message: "Session not found." });
    }

    let sessionInputTokens = 0;
    let sessionOutputTokens = 0;

    let dbHistory = await ChatMessage.findAll({
      where: { session_id },
      order: [['message_id', 'DESC']],
      limit: 6 
    });
    
    dbHistory = dbHistory.reverse();

    const historyForChat = [];
    const historyForRouter = [];
    let expectedRole = 'user';

    dbHistory.forEach(msg => {
      if (msg.sender === 'function') return;

      let safeContent = msg.content;
      if (!safeContent || safeContent.trim() === '') safeContent = "[No response generated]";

      if (safeContent.includes('__PRODUCTS__')) {
        safeContent = safeContent.split('__PRODUCTS__')[0].trim();
      }

      historyForRouter.push(`${msg.sender === 'user' ? 'User' : 'Assistant'}: ${safeContent}`);

      const role = msg.sender === 'model' ? 'model' : 'user';
      if (role === expectedRole) {
        historyForChat.push({ role: role, parts: [{ text: safeContent }] });
        expectedRole = role === 'user' ? 'model' : 'user';
      }
    });

    if (historyForChat.length > 0 && historyForChat[historyForChat.length - 1].role === 'user') {
      historyForChat.pop();
    }

    let intentText = "GENERAL"; 
    try {
        const recentMessages = historyForRouter.join('\n');
            
        const routerPrompt = `Conversation History:\n${recentMessages}\n\nUser's latest message: "${message}"\n\nClassify the intent of the User's latest message based on the conversation context. OUTPUT EXACTLY ONE WORD: 'FAQ', 'PRODUCT', or 'GENERAL'.`;

        const routeResult = await routerModel.generateContent(routerPrompt);
        intentText = routeResult.response.text().trim().toUpperCase();
        console.log(`[ROUTER] Intent classified as: ${intentText}`);

        if (routeResult.response.usageMetadata) {
            const usage = routeResult.response.usageMetadata;
            sessionInputTokens += usage.promptTokenCount;
            sessionOutputTokens += usage.candidatesTokenCount;
            console.log(`[TOKEN] Router Model -> In: ${usage.promptTokenCount}, Out: ${usage.candidatesTokenCount}`);
        }
    } catch (routeErr) {
        console.log(`[ROUTER ERROR] Router failed, falling back to GENERAL.`);
    }

    let activeModel;
    if (intentText.includes("FAQ")) {
        activeModel = faqModel;
    } else if (intentText.includes("PRODUCT")) {
        activeModel = productModel;
    } else {
        activeModel = generalModel;
    }

    const userMsgRecord = await ChatMessage.create({
      session_id, sender: "user", content: message
    });

    const chat = activeModel.startChat({ history: historyForChat });
    let result = await chat.sendMessage(message);
    const response = result.response;
    const functionCalls = response.functionCalls();
    
    if (response.usageMetadata) {
        const usage = response.usageMetadata;
        sessionInputTokens += usage.promptTokenCount;
        sessionOutputTokens += usage.candidatesTokenCount;
        console.log(`[TOKEN] Active Model (${intentText}) -> In: ${usage.promptTokenCount}, Out: ${usage.candidatesTokenCount}`);
    }
    
    let apiResponse = null;
    let replyText = "";

    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      const intent = call.name;
      let args = call.args;

      if (intent === "search_faq") {
        const rawKeywords = args.keywords || [];
        let expandedKeywords = [];
        
        rawKeywords.forEach(kw => {
          let k = kw.toLowerCase().trim();
          expandedKeywords.push(k);
          if (k.includes("webcam") || k.includes("camera")) expandedKeywords.push("camera", "upload");
          if (k === "s" || k === "m" || k === "l" || k === "xl" || k.includes("size")) expandedKeywords.push("size", "represent", "width");
          if (k.includes("try-on") || k.includes("virtual")) expandedKeywords.push("virtual try-on");
          if (k.includes("buy") || k.includes("pay") || k.includes("online")) expandedKeywords.push("booking", "payment", "purchase");
        });

        const finalKeywords = [...new Set(expandedKeywords)].filter(kw => kw.length > 1);

        if (finalKeywords.length === 0) {
          replyText = "I'm sorry, could you please specify what you're looking for?";
        } else {
          const searchConditions = finalKeywords.map(kw => ({
            [Op.or]: [
              { question: { [Op.like]: `%${kw}%` } },
              { answer: { [Op.like]: `%${kw}%` } } 
            ]
          }));

          const faqs = await FAQ.findAll({ where: { [Op.or]: searchConditions }, limit: 3 });
          apiResponse = faqs.map(f => ({ question: f.question, answer: f.answer }));
          
          if(apiResponse.length > 0) {
              const ragPrompt = `You are a helpful customer support assistant. User asked: "${message}". Database info: ${JSON.stringify(apiResponse)}. Write a friendly, natural language answer. ONLY use the database info.`;
              try {
                  const finalGen = await summaryModel.generateContent(ragPrompt);
                  replyText = finalGen.response.text();

                  if (finalGen.response.usageMetadata) {
                      const usage = finalGen.response.usageMetadata;
                      sessionInputTokens += usage.promptTokenCount;
                      sessionOutputTokens += usage.candidatesTokenCount;
                      console.log(`[TOKEN] Summary Model (FAQ) -> In: ${usage.promptTokenCount}, Out: ${usage.candidatesTokenCount}`);
                  }
              } catch (e) {
                  replyText = "I found some information, but I'm having trouble reading it right now.";
              }
          } else {
              replyText = "I couldn't find any specific information about that in our FAQ. Could you try rephrasing?";
          }
        }

      } else if (intent === "recommend_products") {
        const lastFuncMsg = await ChatMessage.findOne({
            where: { session_id, sender: 'user', intent: 'recommend_products' },
            order: [['message_id', 'DESC']]
        });
        
        let previousArgs = {};
        if (lastFuncMsg && lastFuncMsg.entities) {
            try { previousArgs = JSON.parse(lastFuncMsg.entities); } catch(e) {}
        }

        if (args.is_new_search === true) {
            previousArgs = {};
            delete args.is_new_search;
        }

        const userMsgLowerForReset = message.toLowerCase();
        if (userMsgLowerForReset.includes('start over') || userMsgLowerForReset.includes('clear all') || userMsgLowerForReset.includes('reset preferences')) {
            previousArgs = {};
        }

        let finalArgs = { ...previousArgs };
        for (const key in args) {
            if (args[key] === "CLEAR" || args[key] === null) {
                delete finalArgs[key];
            } else if (args[key] && String(args[key]).trim() !== "") {
                finalArgs[key] = args[key];
            }
        }
        args = finalArgs;

        console.log(`Searching for Products with MERGED args:`, args);
        const whereClause = {};
        let isColorSearch = false; 

        const isValidArg = (val) => {
            if (!val) return false;
            const str = String(val).toLowerCase().trim();

            return !['any', 'all', 'none', 'whatever', 'no preference', "doesn't matter", "surprise me", "null", "undefined"].includes(str);
        };

        if (isValidArg(args.frame_shape)) {
            const shape = args.frame_shape.toLowerCase();
            if (shape.includes('round')) whereClause.frame_shape = { [Op.like]: '%round%' };
            else if (shape.includes('square')) whereClause.frame_shape = { [Op.like]: '%square%' };
            else if (shape.includes('rectangle')) whereClause.frame_shape = { [Op.like]: '%rectangle%' };
            else if (shape.includes('wayfarer')) whereClause.frame_shape = { [Op.like]: '%wayfarer%' };
            else if (shape.includes('browline')) whereClause.frame_shape = { [Op.like]: '%browline%' };
            else {
                const cleaned = shape.replace(/frames?/gi, '').replace(/glasses/gi, '').trim();
                if (cleaned) whereClause.frame_shape = { [Op.like]: `%${cleaned}%` };
            }
        }

        if (isValidArg(args.frame_material)) {
            const mat = args.frame_material.toLowerCase();
            if (mat.includes('metal')) whereClause.frame_material = { [Op.like]: '%metal%' };
            else if (mat.includes('plastic')) whereClause.frame_material = { [Op.like]: '%plastic%' };
            else if (mat.includes('acetate')) whereClause.frame_material = { [Op.like]: '%acetate%' };
            else {
                const cleaned = mat.replace(/frames?/gi, '').replace(/glasses/gi, '').trim();
                if (cleaned) whereClause.frame_material = { [Op.like]: `%${cleaned}%` };
            }
        }

        let targetGenderStr = ""; 
        if (isValidArg(args.gender)) {
            targetGenderStr = args.gender.toLowerCase().trim();
        }
        
        if ((!args.gender || !args.face_shape) && req.userId && User) {
            try {
                const user = await User.findByPk(req.userId);
                if (user) {
                    if (!args.gender && user.gender) {
                        targetGenderStr = user.gender.toLowerCase();
                    }
                    if (!args.face_shape && user.face_shape) {
                        args.face_shape = user.face_shape;
                    }
                }
            } catch(e) { console.error("Error fetching user profile for chatbot:", e); }
        }

        if (targetGenderStr) {
            if (targetGenderStr === 'men' || targetGenderStr === 'male') {
                whereClause.gender = { [Op.in]: ['Men', 'men', 'Unisex', 'unisex'] };
                targetGenderStr = "Men";
            } else if (targetGenderStr === 'women' || targetGenderStr === 'female') {
                whereClause.gender = { [Op.in]: ['Women', 'women', 'Unisex', 'unisex'] };
                targetGenderStr = "Women";
            } else {
                whereClause.gender = { [Op.like]: `%${targetGenderStr}%` };
            }
        }

        // Dynamic Color Matching
        if (isValidArg(args.color)) {
            isColorSearch = true;
            const reqColor = args.color.toLowerCase().trim();
            const matchedColorKey = Object.keys(baseColors).find(k => reqColor.includes(k));
            
            const allDbColors = await Product.findAll({ attributes: ['color'], group: ['color'] });
            let dynamicHexMatches = [];
            
            if (matchedColorKey) {
                const targetRgb = baseColors[matchedColorKey];
                allDbColors.forEach(row => {
                    const dbHex = row.color;
                    const dbRgb = hexToRgb(dbHex);
                    if (dbRgb) {
                        const distance = getColorDistance(targetRgb, dbRgb);
                        if (distance < 160 && !dynamicHexMatches.includes(dbHex)) {
                            dynamicHexMatches.push(dbHex);
                        }
                    }
                });
            }
            
            allDbColors.forEach(row => {
               try {
                  const dbHex = row.color;
                  if (dbHex && !dynamicHexMatches.includes(dbHex)) {
                      const names = namer(dbHex);
                      const colorName = names.ntc[0].name.toLowerCase();
                      if (colorName.includes(reqColor) || reqColor.includes(colorName)) {
                          dynamicHexMatches.push(dbHex);
                      }
                  }
               } catch(e) { }
            });

            if (dynamicHexMatches.length > 0) {
                whereClause.color = { [Op.in]: dynamicHexMatches };
            } else {
                whereClause.color = { [Op.like]: `%${args.color}%` };
            }
        }

        if (isValidArg(args.brand)) whereClause.brand = { [Op.like]: `%${args.brand}%` };
        if (isValidArg(args.face_shape)) whereClause.face_shape = { [Op.like]: `%${args.face_shape}%` };
        if (isValidArg(args.frame_size)) whereClause.frame_size = { [Op.like]: `%${args.frame_size}%` };
        if (args.max_price && !isNaN(args.max_price)) whereClause.price = { [Op.lte]: args.max_price };

        let totalCount = await Product.count({ where: whereClause });
        let genderMismatch = false;
        let faceShapeMismatch = false;
        let targetFaceShapeStr = args.face_shape || "";

        if (totalCount === 0) {
            let tempFaceShape = whereClause.face_shape;
            let tempGender = whereClause.gender;

            if (tempFaceShape) {
                console.log(`No products found. Attempting fallback without face_shape restriction...`);
                delete whereClause.face_shape;
                totalCount = await Product.count({ where: whereClause });
                
                if (totalCount > 0) {
                    faceShapeMismatch = true;
                }
            }

            if (totalCount === 0 && tempGender) {
                console.log(`No products found. Attempting fallback without gender restriction...`);
                delete whereClause.gender;
                totalCount = await Product.count({ where: whereClause });
                
                if (totalCount > 0) {
                    genderMismatch = true;
                    if (tempFaceShape && !faceShapeMismatch) {
                        faceShapeMismatch = true; 
                    }
                }
            }
            
            if (totalCount === 0) {
                if (tempFaceShape) whereClause.face_shape = tempFaceShape;
                if (tempGender) whereClause.gender = tempGender;
            }
        }

        const userMsgLower = message.toLowerCase();
        const forceShow = userMsgLower.includes('show') || userMsgLower.includes('all') || userMsgLower.includes('any') || userMsgLower.includes('see') || userMsgLower.includes('skip') || userMsgLower.includes('whatever');

        if (totalCount === 0) {
            replyText = "I'm sorry, I couldn't find any glasses that match those specific preferences. Could you try adjusting the Frame Shape, Face Shape, Material, Color, or Budget?";
            apiResponse = [];
        } else if (totalCount > 5 && !forceShow) {
            console.log(`Too many products (${totalCount}). Asking user to narrow down.`);
            let missingRaw = [];
            if (!args.frame_shape) missingRaw.push("Frame Shape (e.g., Round, Square, Aviator)");
            if (!args.face_shape) missingRaw.push("Face Shape (e.g., Oval, Round, Heart, Square)");
            if (!args.frame_material) missingRaw.push("Material (e.g., Metal, Plastic, Acetate)");
            if (!whereClause.gender && !genderMismatch) missingRaw.push("Gender (e.g., Men, Women)");
            if (!args.max_price) missingRaw.push("Budget (e.g., Under RM200)");
            if (!args.color) missingRaw.push("Color (e.g., Black, Gold)");
            
            let missing = missingRaw.map((item, index) => `${index + 1}. ${item}`);
            
            if (missing.length === 0) {
                missing.push("- Any specific styles or secondary colors?");
            }

            replyText = `I found **${totalCount}** frames that match your preferences! That's a great selection. To help me find the best fit for you, could you share your preferences for any of the following?\n\n` + missing.join('\n') + `\n\n*(Tip: You can provide more details, or just reply 'show me' to see some top options right away!)*`;
            apiResponse = [];
        } else {
            let products = await Product.findAll({
              where: whereClause,
              limit: 5
            });
            apiResponse = [];
            const productIds = products.map(p => p.product_id);
            const imageMap = {};
            
            if (ProductImage) {
                const images = await ProductImage.findAll({
                    where: { product_id: { [Op.in]: productIds }, view_type: 'front' }
                });
                images.forEach(img => {
                    imageMap[img.product_id] = img.image_url;
                });
            }
            
            for (const p of products) {
                let colorName = "Unknown";
                try {
                   if(p.color) {
                       const names = namer(p.color);
                       colorName = names.ntc[0].name; 
                       colorName = colorName.charAt(0).toUpperCase() + colorName.slice(1);
                   }
                } catch(e) { console.error("Color Namer Error:", e.message); }

                apiResponse.push({
                  product_id: p.product_id,
                  brand: p.brand,
                  model: p.model,
                  price: p.price,
                  color_hex: p.color,
                  color_name: colorName,
                  image_url: imageMap[p.product_id] || null, 
                  description: p.description
                });
            }
            console.log(`Product DB search found ${apiResponse.length} items.`);

            // Dynamic Response Generation
            if (faceShapeMismatch && genderMismatch) {
                 replyText = `We don't currently have those exact specs for ${targetGenderStr} with your face shape (${targetFaceShapeStr}), but I found these excellent matches in other categories! You might want to explore other styles.`;
            } else if (faceShapeMismatch) {
                 replyText = `We don't currently have those exact specs for your face shape (${targetFaceShapeStr}), but I found these excellent matches that fit your other preferences! You might want to explore other frame styles.`;
            } else if (genderMismatch) {
                replyText = `We don't currently have those exact specs specifically for ${targetGenderStr}, but I found these excellent matches in other categories that fit your style perfectly!`;
            } else if (isColorSearch && whereClause.color !== 'COLOR_NOT_FOUND_IN_DB') {
                replyText = `I have found some frames in colors close to what you requested. Please take a look below!`;
            } else {
                replyText = "Here are some frames that match your preferences. Please take a look below!";
            }

            if (apiResponse && apiResponse.length > 0) {
                replyText += `\n\n__PRODUCTS__${JSON.stringify(apiResponse)}__PRODUCTS__`;
            }
        }
      }

      userMsgRecord.intent = intent;
      userMsgRecord.entities = JSON.stringify(args);
      await userMsgRecord.save();
    } else {
      try {
        replyText = response.text();
      } catch (e) {
        replyText = "";
      }
    }

    if (!replyText || replyText.trim() === "") {
        replyText = "I'm sorry, I couldn't find specific information regarding that. Please try rephrasing.";
    }
      
    await ChatMessage.create({
        session_id, sender: "model", content: replyText
    });

    const finalMsg = await ChatMessage.findOne({
        where: { session_id },
        order: [['message_id', 'DESC']]
    });

    console.log(`\n=== Total Token Consumption ===`);
    console.log(`Input Tokens (Total): ${sessionInputTokens}`);
    console.log(`Output Tokens (Total): ${sessionOutputTokens}`);
    console.log(`Total Tokens: ${sessionInputTokens + sessionOutputTokens}`);
    console.log(`================================\n`);

    return res.status(200).send(finalMsg);

  } catch (err) {
    console.log(`[CRITICAL ERROR]`, err.message || err);
    if (err.status === 429 || err.status === 503) {
      const currentSessionId = req.body?.session_id || "unknown"; 
      const errorMsg = "I am experiencing a high volume of requests right now. Please wait a few seconds and try asking again!";
      return res.status(200).send({ session_id: currentSessionId, sender: "model", content: errorMsg });
    }
    res.status(500).send({ message: "An error occurred while communicating with the AI chatbot." });
  }
};

exports.endSession = async (req, res) => {
  try {
    const { session_id } = req.params;
    const user_id = req.userId;
    const session = await ChatSession.findOne({ where: { session_id, user_id } });
    if (!session) return res.status(404).send({ message: "Session not found." });

    session.end_time = new Date();
    await session.save();

    res.status(200).send({ message: "Chat session ended successfully." });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};