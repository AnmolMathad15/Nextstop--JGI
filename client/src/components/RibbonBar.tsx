import jgiLogo from "@assets/jgilogo_1764501988673.jpg";

export default function RibbonBar() {
  return (
    <div 
      className="w-full py-3 overflow-hidden sticky top-0 z-50"
      style={{ background: "linear-gradient(90deg, #0f766e, #2563eb)" }}
      data-testid="ribbon-bar"
    >
      <div className="flex items-center gap-4 animate-marquee whitespace-nowrap">
        <img
          src={jgiLogo}
          alt="JGI Logo"
          className="h-10 w-10 rounded-full bg-white p-0.5 shadow-md flex-shrink-0"
          data-testid="img-jgi-logo"
        />
        <span className="text-white font-bold text-xl tracking-wide uppercase" data-testid="text-college-name">
          JAIN COLLEGE OF ENGINEERING AND TECHNOLOGY, HUBBALLI
        </span>
        <img
          src={jgiLogo}
          alt="JGI Logo"
          className="h-10 w-10 rounded-full bg-white p-0.5 shadow-md flex-shrink-0"
        />
        <span className="text-white font-bold text-xl tracking-wide uppercase">
          JAIN COLLEGE OF ENGINEERING AND TECHNOLOGY, HUBBALLI
        </span>
      </div>
    </div>
  );
}
