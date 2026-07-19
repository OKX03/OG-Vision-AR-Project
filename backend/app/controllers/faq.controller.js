const db = require("../models");
const FAQ = db.faq;
const Op = db.Sequelize.Op;

// Controller action to create and save a new FAQ.
exports.createFAQ = async (req, res) => {
  try {
    // Validate request
    if (!req.body.category || !req.body.question || !req.body.answer) {
      return res.status(400).send({
        message: "Content can not be empty!"
      });
    }

    const faq = {
      category: req.body.category,
      question: req.body.question,
      answer: req.body.answer
    };

    const data = await FAQ.create(faq);
    res.send(data);
  } catch (err) {
    res.status(500).send({
      message: err.message || "Some error occurred while creating the FAQ."
    });
  }
};

// Controller action to retrieve all FAQs from the database.
exports.getAllFAQs = async (req, res) => {
  try {
    const data = await FAQ.findAll({
      order: [['faq_id', 'ASC']]
    });
    res.send(data);
  } catch (err) {
    res.status(500).send({
      message: err.message || "Some error occurred while retrieving FAQs."
    });
  }
};

// Controller action to find a single FAQ by its ID.
exports.getFAQById = async (req, res) => {
  try {
    const id = req.params.id;
    const data = await FAQ.findByPk(id);

    if (data) {
      res.send(data);
    } else {
      res.status(404).send({
        message: `Cannot find FAQ with id=${id}.`
      });
    }
  } catch (err) {
    res.status(500).send({
      message: "Error retrieving FAQ with id=" + req.params.id
    });
  }
};

// Controller action to update an existing FAQ by its ID.
exports.updateFAQ = async (req, res) => {
  try {
    const id = req.params.id;

    const [num] = await FAQ.update(req.body, {
      where: { faq_id: id }
    });

    if (num == 1) {
      res.send({
        message: "FAQ was updated successfully."
      });
    } else {
      const existingFaq = await FAQ.findByPk(id);
      if (existingFaq) {
        res.send({
          message: "FAQ was updated successfully (no changes made)."
        });
      } else {
        res.status(404).send({
          message: `Cannot update FAQ with id=${id}. FAQ not found.`
        });
      }
    }
  } catch (err) {
    res.status(500).send({
      message: "Error updating FAQ with id=" + req.params.id
    });
  }
};

// Controller action to delete a FAQ by its ID.
exports.deleteFAQ = async (req, res) => {
  try {
    const id = req.params.id;

    const num = await FAQ.destroy({
      where: { faq_id: id }
    });

    if (num == 1) {
      res.send({
        message: "FAQ was deleted successfully!"
      });
    } else {
      res.status(400).send({
        message: `Cannot delete FAQ with id=${id}. Maybe FAQ was not found!`
      });
    }
  } catch (err) {
    res.status(500).send({
      message: "Could not delete FAQ with id=" + req.params.id
    });
  }
};
