import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { Button } from "./Button";

export function ComingSoon({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-4 py-24">
        <div className="max-w-md text-center">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Building next
          </span>
          <h1 className="mt-3 text-5xl leading-none sm:text-6xl">{title}</h1>
          <p className="mt-4 text-sm text-muted-foreground">{blurb}</p>
          <Button asChild variant="outline" className="mt-8">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" /> Back home
            </Link>
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
