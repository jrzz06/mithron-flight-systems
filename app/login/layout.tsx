import { Toaster } from "sonner";

export default function LoginLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <Toaster position="top-center" richColors duration={1400} />
    </>
  );
}
