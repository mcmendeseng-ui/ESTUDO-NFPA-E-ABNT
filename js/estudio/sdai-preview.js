export const sdaiPreview = {
  id: 'sdai-es-previa-cbmes',
  title: 'Onde instalar o acionador manual?',
  description: 'Veja a montagem junto à entrada e acompanhe o percurso até o acionador em planta.',
  module: 'SDAI · Espírito Santo',
  status: 'Prévia CBMES',
  scenes: Array(3)
};

export async function loadSdaiPreview() {
  const url = new URL('../../projects/sdai-es-previa-cbmes.json?v=montagem', import.meta.url);
  const response = await fetch(url);
  if (!response.ok) throw Error('Não foi possível carregar a prévia de SDAI. Tente recarregar a página.');
  return response.json();
}
