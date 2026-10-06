import React from 'react';

interface ClinicLogoProps {
  className?: string;
  size?: number;
}

export const ClinicLogo: React.FC<ClinicLogoProps> = ({ className = 'w-10 h-10', size }) => {
  return (
    <img
      src="/clinic_logo.png"
      alt="Namana Physiotherapy Clinic"
      {...(size ? { width: size, height: size } : {})}
      className={`shrink-0 select-none object-contain rounded-full shadow-2xs ${className}`}
      referrerPolicy="no-referrer"
    />
  );
};
