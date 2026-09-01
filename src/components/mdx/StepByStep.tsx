interface StepProps {
  number: number;
  title: string;
  children: React.ReactNode;
}

export function Step({ number, title, children }: StepProps) {
  return (
    <div className="flex gap-4 mb-6">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-gradient font-display font-bold text-sm">
        {number}
      </div>
      <div className="flex-1">
        <h3 className="m-0 font-display font-semibold text-white-primary">{title}</h3>
        <div className="mt-2 text-sm text-white-secondary leading-relaxed [&>p]:m-0">
          {children}
        </div>
      </div>
    </div>
  );
}

interface StepByStepProps {
  children: React.ReactNode;
}

export function StepByStep({ children }: StepByStepProps) {
  return <div className="my-8 glass rounded-lg p-6">{children}</div>;
}
