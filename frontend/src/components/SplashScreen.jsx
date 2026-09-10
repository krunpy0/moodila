import AppLogo from "./AppLogo";

export default function SplashScreen() {
  return (
    <div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-6 select-none">
      <div className="flex flex-col items-center gap-3 text-center">
        <AppLogo className="w-16 h-16 rounded-2xl shadow-card animate-pulse" />
        <div>
          <h1 className="text-headline-lg font-bold text-on-surface tracking-tight">
            Moodila
          </h1>
        </div>
        <div className="mt-3 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        </div>
      </div>
    </div>
  )
}
