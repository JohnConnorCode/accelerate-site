import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="text-6xl font-bold text-gold-gradient mb-4"
          style={{ fontFamily: "var(--font-space-grotesk), var(--font-inter), sans-serif" }}
        >
          404
        </p>
        <h1 className="text-2xl font-bold text-white mb-3">Page Not Found</h1>
        <p className="text-white/60 mb-8">
          The page you are looking for does not exist or may have been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/">
            <Button variant="primary">Go Home</Button>
          </Link>
          <Link href="/#solution-generator">
            <Button variant="secondary">Get Your Growth Plan</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
