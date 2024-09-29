const compromise = require("compromise");

const analyzeText = async (text) => {
  let doc = compromise(text);
  let keywords = doc.topics().out("array");

  if (keywords.includes("cleanliness") || keywords.includes("dirty")) {
    return "cleanliness";
  } else if (keywords.includes("damage") || keywords.includes("broken")) {
    return "technical";
  } else if (keywords.includes("staff") || keywords.includes("rude")) {
    return "staff behavior";
  } else if (keywords.includes("safety") || keywords.includes("security")) {
    return "security";
  } else {
    return "general";
  }
};

function getPriority(description) {
  const highPriorityKeywords = [
    "urgent",
    "immediate",
    "critical",
    "failure",
    "emergency",
  ];
  const mediumPriorityKeywords = [
    "important",
    "moderate",
    "attention",
    "issue",
  ];
  const lowPriorityKeywords = ["low", "minor", "suggestion", "enhancement"];

  description = description.toLowerCase(); // Convert to lowercase

  // Check for high-priority keywords
  if (highPriorityKeywords.some((keyword) => description.includes(keyword))) {
    return "High"; // High priority
  }

  // Check for medium-priority keywords
  if (mediumPriorityKeywords.some((keyword) => description.includes(keyword))) {
    return "Medium"; // Medium priority
  }

  // Default to low priority
  return "Low"; // Low priority
}

// Example usage
const priority = getPriority(
  "System failure detected in the production environment"
);
console.log(priority); // Output will be 1

module.exports = { analyzeText, getPriority };
