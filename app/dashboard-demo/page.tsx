import ResultsDashboard from "@/components/results-dashboard";

export default function DashboardDemo() {
  // Sample data with 15 framework scores across different categories
  const sampleData = {
    overallScore: 78,
    analysisDate: "2024-05-31",
    fileName: "startup-pitch-deck-demo.pptx",
    frameworkScores: [
      // Content & Structure (5 frameworks)
      {
        id: "content-clarity",
        name: "Content Clarity",
        score: 85,
        category: "Content & Structure",
        description: "How clearly the content communicates the core message and value proposition",
        feedback: "Your content is well-structured with clear messaging. The value proposition is articulated effectively.",
        recommendations: [
          "Consider adding more specific examples to illustrate key points",
          "Include quantifiable benefits where possible"
        ]
      },
      {
        id: "narrative-flow",
        name: "Narrative Flow",
        score: 72,
        category: "Content & Structure",
        description: "The logical progression and storytelling quality of the presentation",
        feedback: "Good overall flow with some areas that could benefit from smoother transitions.",
        recommendations: [
          "Strengthen transitions between sections",
          "Consider a more compelling opening hook"
        ]
      },
      {
        id: "problem-solution-fit",
        name: "Problem-Solution Fit",
        score: 88,
        category: "Content & Structure",
        description: "How well the solution addresses the identified problem",
        feedback: "Excellent alignment between problem identification and proposed solution.",
        recommendations: [
          "Add more customer validation data",
          "Include competitive differentiation"
        ]
      },
      {
        id: "market-opportunity",
        name: "Market Opportunity",
        score: 65,
        category: "Content & Structure",
        description: "Presentation of market size, growth potential, and target audience",
        feedback: "Market opportunity is presented but lacks depth in market sizing and validation.",
        recommendations: [
          "Include TAM, SAM, SOM analysis",
          "Add market research citations",
          "Provide customer segment validation"
        ]
      },
      {
        id: "business-model",
        name: "Business Model",
        score: 70,
        category: "Content & Structure",
        description: "Clarity and viability of the revenue model and business strategy",
        feedback: "Business model is outlined but could be more detailed and convincing.",
        recommendations: [
          "Detail revenue streams more clearly",
          "Include pricing strategy rationale",
          "Show path to profitability"
        ]
      },

      // Visual Design (3 frameworks)
      {
        id: "visual-appeal",
        name: "Visual Appeal",
        score: 82,
        category: "Visual Design",
        description: "Overall aesthetic quality and professional appearance",
        feedback: "Strong visual design with consistent branding and professional appearance.",
        recommendations: [
          "Consider using more engaging imagery",
          "Ensure all charts are clearly labeled"
        ]
      },
      {
        id: "data-visualization",
        name: "Data Visualization",
        score: 75,
        category: "Visual Design",
        description: "Effectiveness of charts, graphs, and data presentation",
        feedback: "Good use of data visualization with room for improvement in clarity.",
        recommendations: [
          "Simplify complex charts",
          "Use consistent color coding",
          "Add data source citations"
        ]
      },
      {
        id: "slide-layout",
        name: "Slide Layout",
        score: 78,
        category: "Visual Design",
        description: "Organization and balance of content on each slide",
        feedback: "Well-organized slides with good use of white space and hierarchy.",
        recommendations: [
          "Reduce text density on key slides",
          "Improve font size consistency"
        ]
      },

      // Persuasion & Impact (4 frameworks)
      {
        id: "credibility",
        name: "Credibility",
        score: 80,
        category: "Persuasion & Impact",
        description: "Trustworthiness and authority established through evidence and expertise",
        feedback: "Good credibility established through team credentials and early traction.",
        recommendations: [
          "Add more customer testimonials",
          "Include industry expert endorsements",
          "Highlight relevant team experience"
        ]
      },
      {
        id: "emotional-appeal",
        name: "Emotional Appeal",
        score: 68,
        category: "Persuasion & Impact",
        description: "Ability to connect emotionally with the audience",
        feedback: "Some emotional connection established but could be stronger.",
        recommendations: [
          "Include customer success stories",
          "Use more compelling imagery",
          "Add personal anecdotes"
        ]
      },
      {
        id: "urgency-scarcity",
        name: "Urgency & Scarcity",
        score: 55,
        category: "Persuasion & Impact",
        description: "Creation of time-sensitive or limited opportunity perception",
        feedback: "Limited sense of urgency created. Consider emphasizing market timing.",
        recommendations: [
          "Highlight market timing advantages",
          "Emphasize competitive threats",
          "Show limited funding round availability"
        ]
      },
      {
        id: "call-to-action",
        name: "Call to Action",
        score: 73,
        category: "Persuasion & Impact",
        description: "Clarity and strength of the ask and next steps",
        feedback: "Clear call to action with specific ask, but could be more compelling.",
        recommendations: [
          "Make the ask more specific",
          "Provide clear next steps",
          "Include timeline for decision"
        ]
      },

      // Technical Excellence (3 frameworks)
      {
        id: "financial-projections",
        name: "Financial Projections",
        score: 71,
        category: "Technical Excellence",
        description: "Quality and realism of financial forecasts and assumptions",
        feedback: "Financial projections are present but assumptions could be better justified.",
        recommendations: [
          "Provide detailed assumption rationale",
          "Include sensitivity analysis",
          "Compare to industry benchmarks"
        ]
      },
      {
        id: "competitive-analysis",
        name: "Competitive Analysis",
        score: 66,
        category: "Technical Excellence",
        description: "Depth and accuracy of competitive landscape assessment",
        feedback: "Basic competitive analysis provided but lacks depth and differentiation clarity.",
        recommendations: [
          "Include detailed competitor comparison",
          "Highlight unique differentiators",
          "Address competitive threats"
        ]
      },
      {
        id: "risk-mitigation",
        name: "Risk Mitigation",
        score: 62,
        category: "Technical Excellence",
        description: "Identification and addressing of potential risks and challenges",
        feedback: "Some risks identified but mitigation strategies could be more comprehensive.",
        recommendations: [
          "Identify key business risks",
          "Provide specific mitigation plans",
          "Include contingency strategies"
        ]
      }
    ]
  };

  return <ResultsDashboard data={sampleData} />;
} 