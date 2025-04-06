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
      
      // Validate and format CEP
      const { formatted, valid } = formatCEP(franchise.cep);
      franchise.cep = formatted;
      
      if (!valid) {
        franchise.status = 'CEP inválido. Formato esperado: XXXXX-XXX (8 dígitos)';
        processed.push(franchise);
        setProgress(Math.round(((i + 1) / franchises.length) * 100));
        continue;
      }
      
      try {
        // Using ViaCEP API to get address information from the Brazilian postal code
        // Send only the digits to the API
        const cepDigits = formatted.replace('-', '');
        const response = await axios.get(`https://viacep.com.br/ws/${cepDigits}/json/`);
        
        if (response.data.erro) {
          console.error(`CEP não encontrado: ${franchise.cep}`);
          franchise.status = 'CEP não encontrado';
        } else {
          // Construct address for geocoding
          const address = `${response.data.logradouro}, ${response.data.localidade}, ${response.data.uf}, Brasil`;
          
          // Using Nominatim OpenStreetMap API for geocoding (free and no API key required)
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
            // Garantindo que os valores são strings com ponto como separador decimal
            franchise.latitude = String(geoResponse.data[0].lat).replace(',', '.');
            franchise.longitude = String(geoResponse.data[0].lon).replace(',', '.');
            franchise.status = 'Sucesso';
          } else {
            franchise.status = 'Endereço não encontrado';
          }
        }
      } catch (error) {
        console.error(`Erro ao buscar coordenadas para o CEP ${franchise.cep}:`, error);
        franchise.status = 'Erro na requisição';
      }
      
      processed.push(franchise);
      setProgress(Math.round(((i + 1) / franchises.length) * 100));
      
      // Add a small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    setProcessedFranchises(processed);
    setIsLoading(false);
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <h1 className="text-3xl font-bold mb-8">Busca de Latitude e Longitude</h1>
      
      <div className="w-full max-w-3xl bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">Upload de Arquivo CSV</h2>
        <p className="mb-4">
          Faça upload de um arquivo CSV contendo as colunas: id, nome, cep
          <Link 
            href="/exemplo-franquias.csv" 
            className="ml-2 text-blue-600 hover:text-blue-800 underline"
            download
          >
            (Baixar exemplo)
          </Link>
        </p>
        
        <div className="mb-4">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
        </div>
        
        {franchises.length > 0 && (
          <div className="mt-4">
            <p className="mb-2">{franchises.length} registros carregados</p>
            <button
              onClick={fetchCoordinates}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:bg-blue-300"
            >
              {isLoading ? 'Processando...' : 'Buscar Coordenadas'}
            </button>
          </div>
        )}
        
        {isLoading && (
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 mt-1">{progress}% completo</p>
          </div>
        )}
      </div>
      
      {processedFranchises.length > 0 && (
        <div className="w-full max-w-5xl bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-semibold">Resultados</h2>
              <p className="text-xs text-gray-500 mt-1">Coordenadas no formato decimal com ponto (ex: -23.550520, -46.633309)</p>
            </div>
            <CSVLink
              data={processedFranchises}
              headers={csvHeaders}
              filename={'franquias-com-coordenadas.csv'}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            >
              Exportar CSV
            </CSVLink>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CEP</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Latitude</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Longitude</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {processedFranchises.map((franchise, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{franchise.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{franchise.nome}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{franchise.cep}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{franchise.latitude}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{franchise.longitude}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${franchise.status === 'Sucesso' ? 'text-green-500' : 'text-red-500'}`}>
                      {franchise.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
