import React from 'react';

interface GofamintLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export const GofamintLogo: React.FC<GofamintLogoProps> = ({
  className = 'w-12 h-12',
  size,
  showText = false
}) => {
  const style = size ? { width: size, height: size } : undefined;

  return (
    <div className={`inline-flex items-center gap-2.5 ${showText ? 'flex-row' : ''}`}>
      <img
        src="/gofamint-logo.svg"
        alt="The Gospel Faith Mission International (House of Favour) (GOFAMINT_HOF) Official Logo"
        className={`${className} shrink-0 object-contain`}
        style={style}
      />

      {showText && (
        <div className="flex flex-col">
          <span className="font-['Cinzel',serif] font-black text-sm tracking-wider text-amber-400 leading-tight uppercase">
            GOFAMINT_HOF
          </span>
          <span className="text-[9px] font-semibold text-blue-200 tracking-tight leading-tight">
            The Gospel Faith Mission Int'l (House of Favour)
          </span>
        </div>
      )}
    </div>
  );
};
