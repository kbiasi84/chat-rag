import Image from 'next/image';

export function AuthSidebar() {
  return (
    <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-dp-gray to-dp-gray/90 items-center justify-center p-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-5" />
      <div className="relative z-10 text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="w-32 h-32 relative">
            <Image
              src="logos/logo-ChatDP-preta.png"
              alt="Logo ChatDP"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>
        <h1 className="text-5xl font-bold text-dp-black mb-2">
          Chat<span className="text-dp-orange">DP</span>
        </h1>
        <p className="text-dp-black text-lg opacity-90 mb-8">
          Sua equipe jurídica virtual: IA avançada com conhecimento legal
          trabalhista para assessorar seu Departamento Pessoal e questões
          trabalhista com precisão e agilidade.
        </p>

        <div className="bg-[#5FDF33]/10 border border-[#5FDF33]/30 p-4 rounded-xl mb-8 text-center">
          <p className="text-dp-black font-medium">
            Assessorando em questões complexas em tempo real.
          </p>
        </div>
      </div>
    </div>
  );
}
