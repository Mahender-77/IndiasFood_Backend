import React, { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 w-full border-b bg-background">
        <div className="container-custom flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
          <h1 className="text-xl font-bold">Delivery App</h1>
          {/* Add navigation for delivery app here */}
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
      <footer className="border-t bg-background py-6 md:py-0">
        <div className="container-custom flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
          <p className="text-balance text-center text-sm leading-loose text-muted-foreground md:text-left">
            © {new Date().getFullYear()} Delivery App. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

