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

const RCJ_SUGGESTIONS = [
  'My Vaporfly 3s have 412 miles on them. Should I retire them or is this character-building?',
  "My Garmin says 'Body Battery: 14'. Should I cancel my 20-miler or just ignore it?",
  'I missed my BQ by 8 seconds. Is my life over, or just mostly over?',
  'How many gels should I take for a 5K? I usually do 2 but considering 3.',
  'Someone stole my Strava KOM. What training block do I need to take it back?',
  "My VDOT says I should run 3:42 but in my heart I know I'm a 3:28 person. Who's right?",
  'The dew point was 68°F. What was my "real" pace adjusted for optimal conditions?',
  'My HRV this morning was 43. My coach says run. My Garmin says rest. Who wins?',
  "If I do a run and forget to start my Garmin, did it still count?",
  "I have taper madness and think I've developed 4 new injuries this week. Are any real?",
  'My easy run pace was 8:32. Is that Zone 2 or am I secretly a slow elite?',
  'My physio said 6 weeks off. What\'s a good 6-week training block I can do instead?',
];

interface Props {
  onSelect: (question: string) => void;
  funMode?: boolean;
}

function ActivityIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polyline
        points="2 12 6 12 8 5 10 19 13 9 15 15 17 12 22 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function SuggestedQuestions({ onSelect, funMode = false }: Props) {
  const suggestions = funMode ? RCJ_SUGGESTIONS : SUGGESTIONS;

  return (
    <div className="flex flex-col items-center gap-6 px-3 py-8 sm:px-4 sm:py-12">
      <div className="text-center">
        <div
          className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-white sm:h-16 sm:w-16 ${funMode ? 'bg-rcj' : 'bg-garmin-blue'}`}
        >
          <ActivityIcon />
        </div>
        <h2 className="text-xl font-semibold text-garmin-text">
          {funMode ? 'RunBot 9000' : 'Ask My Garmin'}
        </h2>
        <p className="mt-1 text-sm text-garmin-text-muted">
          {funMode
            ? "What does your Garmin say? (It's probably fine.)"
            : 'Get personalized training insights from your Garmin data using AI.'}
        </p>
      </div>

      <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
        {suggestions.map((q) => (
          <button
            key={q}
            onClick={() => onSelect(q)}
            className={`rounded-xl border border-garmin-border bg-garmin-surface px-3 py-3 text-left text-sm text-garmin-text shadow-sm transition-colors sm:px-4 ${
              funMode
                ? 'hover:border-rcj hover:bg-garmin-surface-2'
                : 'hover:border-garmin-blue hover:bg-garmin-surface-2'
            }`}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
