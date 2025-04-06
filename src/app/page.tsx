"use client";

import axios from 'axios';
import Link from 'next/link';
import Papa from 'papaparse';
import { useState } from 'react';
import { CSVLink } from 'react-csv';

interface Franchise {
  id: string;
  nome: string;
  cep: string;
  latitude?: string;
  longitude?: string;
  status?: string;
}

// Adicione esta constante após a interface Franchise
const csvHeaders = [
  { label: 'ID', key: 'id' },
  { label: 'Nome', key: 'nome' },
  { label: 'CEP', key: 'cep' },
  { label: 'Latitude', key: 'latitude' },
  { label: 'Longitude', key: 'longitude' },
  { label: 'Status', key: 'status' }
];

export default function Home() {
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [processedFranchises, setProcessedFranchises] = useState<Franchise[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [singleCep, setSingleCep] = useState('');
  const [singleName, setSingleName] = useState('');

  // Function to validate and format CEP
  const formatCEP = (cep: string): { formatted: string; valid: boolean } => {
    // Remove any non-digit characters
    const digits = cep.replace(/\D/g, '');
    
    // Check if it has exactly 8 digits
    if (digits.length !== 8) {
      return { formatted: cep, valid: false };
    }
    
    // Format as XXXXX-XXX
    const formatted = `${digits.substring(0, 5)}-${digits.substring(5)}`;
    return { formatted, valid: true };
  };

  // Função auxiliar para buscar coordenadas para um CEP
  const fetchCoordinatesForCep = async (cep: string): Promise<{latitude: string, longitude: string, status: string}> => {
    // Validate and format CEP
    const { formatted, valid } = formatCEP(cep);
    
    if (!valid) {
      return {
        latitude: 'N/A',
        longitude: 'N/A',
        status: 'CEP inválido. Formato esperado: XXXXX-XXX (8 dígitos)'
      };
    }
    
    // Send only the digits to the API
    const cepDigits = formatted.replace('-', '');
    
    try {
      const response = await axios.get(`https://viacep.com.br/ws/${cepDigits}/json/`);
      
      if (response.data.erro) {
        console.error(`CEP não encontrado: ${formatted}`);
        return {
          latitude: 'N/A',
          longitude: 'N/A',
          status: 'CEP não encontrado'
        };
      } else {
        // Construct address for geocoding
        const address = `${response.data.logradouro || ''}, ${response.data.localidade}, ${response.data.uf}, Brasil`;
        
        try {
          // Using Nominatim OpenStreetMap API for geocoding
          const geoResponse = await axios.get(`https://nominatim.openstreetmap.org/search`, {
            params: {
              q: address,
              format: 'json',
              limit: 1
            },
            headers: {
              'User-Agent': 'BuscaLatLong-App'
            }
          });
          
          if (geoResponse.data && geoResponse.data.length > 0) {
            return {
              latitude: String(geoResponse.data[0].lat).replace(',', '.'),
              longitude: String(geoResponse.data[0].lon).replace(',', '.'),
              status: 'Sucesso'
            };
          } else {
            return {
              latitude: 'N/A',
              longitude: 'N/A',
              status: 'Endereço não encontrado'
            };
          }
        } catch (geoError) {
          console.error(`Erro na API de geolocalização: ${geoError}`);
          return {
            latitude: 'N/A',
            longitude: 'N/A',
            status: 'Erro na API de geolocalização'
          };
        }
      }
    } catch (viaCepError) {
      console.error(`Erro na API ViaCEP: ${viaCepError}`);
      
      // Tentar buscar pela localidade se for um CEP geral de cidade (final 000)
      if (cepDigits.endsWith('000')) {
        try {
          // Extrair os primeiros 5 dígitos do CEP para buscar aproximadamente a cidade
          const cepPrefix = cepDigits.substring(0, 5);
          // Buscar por um CEP próximo que possa existir
          const alternativeResponse = await axios.get(`https://viacep.com.br/ws/${cepPrefix}010/json/`);
          
          if (!alternativeResponse.data.erro) {
            const city = alternativeResponse.data.localidade;
            const state = alternativeResponse.data.uf;
            
            if (city && state) {
              // Tentar geolocalizar apenas com cidade e estado
              const cityAddress = `${city}, ${state}, Brasil`;
              const geoResponse = await axios.get(`https://nominatim.openstreetmap.org/search`, {
                params: {
                  q: cityAddress,
                  format: 'json',
                  limit: 1
                },
                headers: {
                  'User-Agent': 'BuscaLatLong-App'
                }
              });
              
              if (geoResponse.data && geoResponse.data.length > 0) {
                return {
                  latitude: String(geoResponse.data[0].lat).replace(',', '.'),
                  longitude: String(geoResponse.data[0].lon).replace(',', '.'),
                  status: 'Sucesso (aproximado por cidade)'
                };
              }
            }
          }
        } catch (alternativeError) {
          console.error(`Falha na busca alternativa: ${alternativeError}`);
          // Continuar com o retorno padrão
        }
      }
      
      return {
        latitude: 'N/A',
        longitude: 'N/A',
        status: 'Erro na API ViaCEP'
      };
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const data = results.data as Franchise[];
        setFranchises(data);
        setProcessedFranchises([]);
        setProgress(0);
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
        alert('Erro ao processar o arquivo CSV. Por favor, verifique o formato.');
      }
    });
  };

  const fetchCoordinates = async () => {
    if (franchises.length === 0) {
      alert('Nenhum dado para processar. Por favor, faça upload de um arquivo CSV.');
      return;
    }

    setIsLoading(true);
    setProgress(0);
    
    const processed: Franchise[] = [];
    
    // Process franchises one by one to handle rate limits of geocoding APIs
    for (let i = 0; i < franchises.length; i++) {
      // Inicializar com valores padrão para todos os campos
      const franchise: Franchise = { 
        ...franchises[i],
        latitude: 'N/A',
        longitude: 'N/A', 
        status: 'Não processado'
      };
      
      try {
        // Buscar coordenadas para o CEP
        const result = await fetchCoordinatesForCep(franchise.cep);
        
        // Atualizar o formato do CEP
        franchise.cep = formatCEP(franchise.cep).formatted;
        
        // Atualizar os resultados
        franchise.latitude = result.latitude;
        franchise.longitude = result.longitude;
        franchise.status = result.status;
      } catch (error) {
        console.error(`Erro ao processar CEP ${franchise.cep}:`, error);
        franchise.status = 'Erro inesperado';
      }
      
      processed.push(franchise);
      setProgress(Math.round(((i + 1) / franchises.length) * 100));
      
      // Add a small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    setProcessedFranchises(processed);
    setIsLoading(false);
  };

  // Função para limpar os resultados
  const handleClear = () => {
    setProcessedFranchises([]);
  };

  // Função para limpar tudo e começar do zero
  const handleReset = () => {
    setFranchises([]);
    setProcessedFranchises([]);
    setProgress(0);
    setSingleCep('');
    setSingleName('');
  };

  // Função para processar um CEP individual
  const handleSingleCep = async () => {
    if (!singleCep.trim()) {
      alert('Por favor, digite um CEP válido.');
      return;
    }

    setIsLoading(true);
    
    // Inicializar com valores padrão
    const franchise: Franchise = { 
      id: Date.now().toString(),
      nome: singleName.trim() || 'Consulta individual',
      cep: singleCep,
      latitude: 'N/A',
      longitude: 'N/A', 
      status: 'Não processado'
    };
    
    try {
      // Buscar coordenadas para o CEP
      const result = await fetchCoordinatesForCep(franchise.cep);
      
      // Atualizar o formato do CEP
      franchise.cep = formatCEP(franchise.cep).formatted;
      
      // Atualizar os resultados
      franchise.latitude = result.latitude;
      franchise.longitude = result.longitude;
      franchise.status = result.status;
    } catch (error) {
      console.error(`Erro ao processar CEP ${franchise.cep}:`, error);
      franchise.status = 'Erro inesperado';
    }
    
    setProcessedFranchises([franchise]);
    setIsLoading(false);
  };

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-800 mb-3">Busca de Latitude e Longitude</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Converta CEPs para coordenadas geográficas em segundos. Consulte individualmente ou processe múltiplos registros via CSV.
          </p>
        </header>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Painel Esquerdo - Consulta Individual */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-md p-6 transition-all hover:shadow-lg">
              <h2 className="text-xl font-semibold text-gray-800 mb-5 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                Consulta Individual
              </h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="singleName" className="block text-sm font-medium text-gray-700 mb-1">
                    Nome (opcional)
                  </label>
                  <input
                    type="text"
                    id="singleName"
                    value={singleName}
                    onChange={(e) => setSingleName(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="Nome da franquia"
                  />
                </div>
                <div>
                  <label htmlFor="singleCep" className="block text-sm font-medium text-gray-700 mb-1">
                    CEP
                  </label>
                  <input
                    type="text"
                    id="singleCep"
                    value={singleCep}
                    onChange={(e) => setSingleCep(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleSingleCep();
                      }
                    }}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="01310-100"
                  />
                </div>
                <button
                  onClick={handleSingleCep}
                  disabled={isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processando...
                    </span>
                  ) : (
                    'Buscar Coordenadas'
                  )}
                </button>
              </div>
            </div>
          </div>
          
          {/* Painel Direito - Upload CSV */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-md p-6 transition-all hover:shadow-lg">
              <h2 className="text-xl font-semibold text-gray-800 mb-5 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 13H11V9.413l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13H5.5z" />
                  <path d="M9 13h2v5a1 1 0 11-2 0v-5z" />
                </svg>
                Upload de Arquivo CSV
              </h2>
              <p className="mb-5 text-gray-600">
                Faça upload de um arquivo CSV contendo as colunas: id, nome, cep
                <Link 
                  href="/exemplo-franquias.csv" 
                  className="ml-2 text-blue-600 hover:text-blue-800 underline inline-flex items-center"
                  download
                >
                  Baixar exemplo
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </Link>
              </p>
              
              <div className="mb-6">
                <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-6 transition-all hover:border-blue-500">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="mt-2 text-sm text-gray-600">
                      Arraste e solte seu arquivo CSV aqui, ou <span className="text-blue-600 font-medium">clique para selecionar</span>
                    </p>
                  </div>
                </div>
              </div>
            
              {franchises.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 bg-gray-100 py-1 px-3 rounded-full">
                      {franchises.length} registros carregados
                    </span>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={fetchCoordinates}
                        disabled={isLoading}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center"
                      >
                        {isLoading ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processando...
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                            </svg>
                            Buscar Coordenadas
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleReset}
                        disabled={isLoading}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Limpar Arquivo
                      </button>
                    </div>
                  </div>
                  
                  {isLoading && (
                    <div className="mt-4">
                      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between mt-1">
                        <p className="text-xs text-gray-600">{progress}% completo</p>
                        <p className="text-xs text-gray-600">Processando {Math.round((progress / 100) * franchises.length)} de {franchises.length}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Resultados */}
        {processedFranchises.length > 0 && (
          <div className="mt-10 bg-white rounded-xl shadow-md p-6 transition-all hover:shadow-lg">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-gray-800 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-indigo-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V8z" clipRule="evenodd" />
                  </svg>
                  Resultados
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Coordenadas no formato decimal com ponto (ex: -23.550520, -46.633309)
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleClear}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                  Limpar Resultados
                </button>
                <CSVLink
                  data={processedFranchises}
                  headers={csvHeaders}
                  filename={'franquias-com-coordenadas.csv'}
                  className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Exportar CSV
                </CSVLink>
              </div>
            </div>
            
            <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CEP</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Latitude</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Longitude</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {processedFranchises.map((franchise, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{franchise.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{franchise.nome}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-mono">{franchise.cep}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-mono">{franchise.latitude}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-mono">{franchise.longitude}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {franchise.status === 'Sucesso' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <svg className="-ml-0.5 mr-1 h-3 w-3 text-green-500" fill="currentColor" viewBox="0 0 8 8">
                              <circle cx="4" cy="4" r="3" />
                            </svg>
                            {franchise.status}
                          </span>
                        )}
                        {franchise.status === 'Sucesso (aproximado por cidade)' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            <svg className="-ml-0.5 mr-1 h-3 w-3 text-blue-500" fill="currentColor" viewBox="0 0 8 8">
                              <circle cx="4" cy="4" r="3" />
                            </svg>
                            Aproximado
                          </span>
                        )}
                        {franchise.status !== 'Sucesso' && franchise.status !== 'Sucesso (aproximado por cidade)' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <svg className="-ml-0.5 mr-1 h-3 w-3 text-red-500" fill="currentColor" viewBox="0 0 8 8">
                              <circle cx="4" cy="4" r="3" />
                            </svg>
                            {franchise.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        <footer className="mt-12 text-center text-gray-500 text-sm">
          <p>
            Desenvolvido com Next.js, Tailwind CSS e APIs ViaCEP e OpenStreetMap.
          </p>
        </footer>
      </div>
    </main>
  );
}
