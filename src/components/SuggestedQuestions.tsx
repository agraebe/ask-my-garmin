const SUGGESTIONS = [
  'Am I ready to run a sub-2-hour half marathon in 6 weeks?',
  'What\'s the right easy pace for me to be running?',
  'Why do I keep getting injured in week 8 of marathon training?',
  'Should I do my tempo run today or rest? My HRV is down but I slept 8 hours.',
  'Which training plan should I use given where I am right now?',
  'I missed 10 days sick — how do I pick back up without getting injured?',
  'How many miles did I run this week?',
  'What was my average heart rate on my last workout?',
  'How did I sleep last night and how is my recovery today?',
  'What\'s my training stress balance looking like?',
  'How is my fitness trending over the past month?',
  'What heart rate zones should I be training in?',
];

interface Props {
  onSelect: (question: string) => void;
}

export default function SuggestedQuestions({ onSelect }: Props) {
  return (
    <div className="flex flex-col items-center gap-6 py-12 px-4">
      <div className="text-center">
        <div className="w-16 h-16 bg-garmin-blue rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-white text-2xl font-bold">G</span>
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Ask My Garmin</h2>
        <p className="text-gray-500 mt-1 text-sm">
          Get personalized training insights from your Garmin data using AI.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
        {SUGGESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onSelect(q)}
            className="text-left px-4 py-3 rounded-xl border border-gray-200 bg-white hover:border-garmin-blue hover:bg-blue-50 text-sm text-gray-700 transition-colors shadow-sm"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
