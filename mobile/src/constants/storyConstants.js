export const clips = {};

export const questions = [
  {
    id: "clarity",
    text: "Was the teacher's explanation clear?",
    options: [
      { label: "Very clear", score: 2 },
      { label: "Somewhat clear", score: 1 },
      { label: "Not clear", score: 0 },
    ],
  },
  {
    id: "patience",
    text: "Did the teacher handle questions patiently?",
    options: [
      { label: "Yes, very patient", score: 2 },
      { label: "Somewhat patient", score: 1 },
      { label: "Not patient", score: 0 },
    ],
  },
  {
    id: "confidence",
    text: "How confident do you feel after the lesson?",
    options: [
      { label: "Very confident", score: 2 },
      { label: "A bit confident", score: 1 },
      { label: "Not confident", score: 0 },
    ],
  },
];
