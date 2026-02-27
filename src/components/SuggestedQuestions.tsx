const SUGGESTIONS = [
  'Am I ready to run a sub-2-hour half marathon in 6 weeks?',
  "What's the right easy pace for me to be running?",
  'Why do I keep getting injured in week 8 of marathon training?',
  'Should I do my tempo run today or rest? My HRV is down but I slept 8 hours.',
  'Which training plan should I use given where I am right now?',
  'I missed 10 days sick — how do I pick back up without getting injured?',
  'How many miles did I run this week?',
  'What was my average heart rate on my last workout?',
  'How did I sleep last night and how is my recovery today?',
  "What's my training stress balance looking like?",
  'How is my fitness trending over the past month?',
  'What heart rate zones should I be training in?',
];

interface Props {
  onSelect: (question: string) => void;
}

function GarminIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function SuggestedQuestions({ onSelect }: Props) {
  return (
    <div className="flex flex-col items-center gap-6 px-3 py-8 sm:px-4 sm:py-12">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-garmin-blue text-white sm:h-16 sm:w-16">
          <GarminIcon />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Ask My Garmin</h2>
        <p className="mt-1 text-sm text-gray-500">
          Get personalized training insights from your Garmin data using AI.
        </p>
      </div>

      <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onSelect(q)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-left text-sm text-gray-700 shadow-sm transition-colors hover:border-garmin-blue hover:bg-blue-50 sm:px-4"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
