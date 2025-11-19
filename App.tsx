
import React, { useState, useCallback, useRef } from 'react';
import { generateImageWithText, generateImageWithReference } from './services/geminiService';
import { Spinner } from './components/Spinner';
import { ImagePlaceholderIcon, ErrorIcon, UploadIcon, RemoveIcon, DownloadIcon } from './components/Icons';

const App: React.FC = () => {
  const [prompt, setPrompt] = useState<string>('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [referenceImage, setReferenceImage] = useState<{ data: string; mimeType: string } | null>(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditing = generatedImage !== null;

  const getBase64FromDataUrl = (dataUrl: string) => dataUrl.split(',')[1];

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (!dataUrl) return;

        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            setError("Não foi possível processar a imagem. O contexto do canvas não está disponível.");
            return;
          }

          const targetAspectRatio = 16 / 9;
          
          let srcWidth = img.width;
          let srcHeight = img.height;
          let srcX = 0;
          let srcY = 0;

          const currentAspectRatio = srcWidth / srcHeight;

          // Calculate cropping dimensions to achieve a 16:9 center crop
          if (currentAspectRatio > targetAspectRatio) {
            // Image is wider than target, crop the sides
            srcWidth = srcHeight * targetAspectRatio;
            srcX = (img.width - srcWidth) / 2;
          } else if (currentAspectRatio < targetAspectRatio) {
            // Image is taller than target, crop the top and bottom
            srcHeight = srcWidth / targetAspectRatio;
            srcY = (img.height - srcHeight) / 2;
          }
          
          // Set a standard 16:9 resolution for the output canvas
          canvas.width = 1280;
          canvas.height = 720;
          
          // Draw the cropped and resized image onto the canvas
          ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, canvas.width, canvas.height);

          // Get the new 16:9 image as a data URL
          const croppedMimeType = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
          const croppedDataUrl = canvas.toDataURL(croppedMimeType, 0.95);
          
          setReferenceImagePreview(croppedDataUrl);
          setReferenceImage({
            data: getBase64FromDataUrl(croppedDataUrl),
            mimeType: croppedMimeType,
          });
        };
        img.onerror = () => {
          setError("Falha ao carregar a imagem de referência. O arquivo pode estar corrompido ou em um formato não suportado.");
        }
        img.src = dataUrl;
      };
      reader.onerror = () => {
        setError("Falha ao ler o arquivo selecionado.");
      }
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveReferenceImage = () => {
    setReferenceImage(null);
    setReferenceImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  
  const handleStartOver = () => {
    setGeneratedImage(null);
    setReferenceImage(null);
    setReferenceImagePreview(null);
    setPrompt('');
    setError(null);
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = 'thumbnail-gerada.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateClick = useCallback(async () => {
    const currentPrompt = prompt.trim();
    if (!currentPrompt) {
      setError(isEditing ? "Por favor, descreva o ajuste desejado." : "Por favor, insira uma descrição para a thumbnail.");
      return;
    }
    setIsLoading(true);
    setError(null);
    
    if (!isEditing) {
        setGeneratedImage(null);
    }

    try {
      let newBase64Image;
      if (isEditing) {
        const imagesForApi = [{
            data: getBase64FromDataUrl(generatedImage!),
            mimeType: 'image/png'
        }];
        if (referenceImage) {
            imagesForApi.push(referenceImage);
        }
        newBase64Image = await generateImageWithReference(currentPrompt, imagesForApi);
      } else if (referenceImage) {
        newBase64Image = await generateImageWithReference(currentPrompt, [referenceImage]);
      } else {
        newBase64Image = await generateImageWithText(currentPrompt);
      }
      setGeneratedImage(`data:image/png;base64,${newBase64Image}`);
      if(isEditing) {
        setPrompt(""); 
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Ocorreu um erro desconhecido ao gerar a imagem.");
    } finally {
      setIsLoading(false);
    }
  }, [prompt, generatedImage, referenceImage, isEditing]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto max-w-7xl">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
            Gerador de Thumbnails com IA
          </h1>
          <p className="text-gray-400 mt-2 text-lg">
            Crie, ajuste e aperfeiçoe sua thumbnail dos sonhos.
          </p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Controls Section */}
          <div className="flex flex-col bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
            <label htmlFor="prompt" className="text-lg font-semibold mb-2 text-gray-300">
              {isEditing ? 'Descreva os ajustes que você deseja' : 'Sua Descrição Detalhada'}
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={isEditing ? 'Ex: Mude a cor da arma para azul...' : 'Ex: Um astronauta surfando em um anel de Saturno...'}
              className="flex-grow bg-gray-900 border border-gray-600 rounded-lg p-4 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-300 resize-none h-64 text-gray-200"
              disabled={isLoading}
            />
            
            <div className="mt-4">
              <label className="text-sm font-semibold mb-2 text-gray-400 block">
                {isEditing ? 'Adicionar Referência para o Ajuste (Opcional)' : 'Imagem de Referência (Opcional)'}
              </label>
              {referenceImagePreview ? (
                <div className="relative group w-48 border border-gray-600 rounded-lg p-2">
                   <img src={referenceImagePreview} alt="Referência" className="w-full h-auto rounded-md" />
                   <button 
                     onClick={handleRemoveReferenceImage}
                     className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                     aria-label="Remover imagem de referência"
                   >
                     <RemoveIcon className="w-4 h-4" />
                   </button>
                </div>
              ) : (
                <div>
                  <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
                  >
                    <UploadIcon className="w-5 h-5 mr-2" />
                    Enviar Imagem
                  </button>
                </div>
              )}
            </div>
            
            <div className="mt-6 flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleGenerateClick}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
              >
                {isLoading && <Spinner className="w-5 h-5 mr-2" />}
                {isLoading ? (isEditing ? 'Ajustando...' : 'Gerando...') : (isEditing ? 'Ajustar Imagem' : 'Gerar Thumbnail')}
              </button>
              {isEditing && (
                <button
                  onClick={handleStartOver}
                  disabled={isLoading}
                  className="w-full sm:w-auto bg-gray-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-500 transition-all duration-300 disabled:opacity-50"
                >
                  Começar de Novo
                </button>
              )}
            </div>
          </div>

          {/* Image Display Section */}
          <div className="flex flex-col items-center justify-center bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700 aspect-video relative">
            {isLoading && !generatedImage && (
              <div className="text-center">
                <Spinner className="w-16 h-16 mx-auto text-purple-400" />
                <p className="mt-4 text-gray-400">Gerando sua obra de arte...</p>
              </div>
            )}
            {error && (
              <div className="text-center text-red-400">
                <ErrorIcon className="w-16 h-16 mx-auto" />
                <p className="mt-4 font-semibold">Oops! Algo deu errado.</p>
                <p className="text-sm text-gray-500 mt-1">{error}</p>
              </div>
            )}
            {!error && generatedImage && (
              <>
                <div className="relative w-full h-full">
                  <img
                      src={generatedImage}
                      alt="Thumbnail gerada"
                      className={`w-full h-full object-contain rounded-lg shadow-2xl transition-opacity duration-500 ${isLoading ? 'opacity-50' : 'opacity-100'}`}
                  />
                  {isLoading && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-50 rounded-lg">
                          <Spinner className="w-12 h-12 text-purple-400" />
                          <p className="mt-3 text-white font-semibold">Ajustando a imagem...</p>
                      </div>
                  )}
                </div>
                <button
                  onClick={handleDownload}
                  disabled={isLoading}
                  className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
                >
                  <DownloadIcon className="w-5 h-5 mr-2" />
                  Baixar Imagem
                </button>
              </>
            )}
            {!isLoading && !error && !generatedImage && (
              <div className="text-center text-gray-500">
                <ImagePlaceholderIcon className="w-24 h-24 mx-auto" />
                <p className="mt-4 text-lg">Sua thumbnail aparecerá aqui</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
