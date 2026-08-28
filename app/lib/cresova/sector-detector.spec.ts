import { describe, expect, it } from 'vitest';
import { detectSector } from './sector-detector';

describe('detectSector', () => {
  it('detects salud from a dental clinic request', () => {
    const sector = detectSector('una web para una clínica dental en Tegucigalpa');
    expect(sector).toBe('salud, legal, financiero, profesional');
  });

  it('detects salud from a lawyer request', () => {
    const sector = detectSector('página web para un abogado');
    expect(sector).toBe('salud, legal, financiero, profesional');
  });

  it('detects gastronomía from a restaurant request', () => {
    const sector = detectSector('landing page para un restaurante de cocina de mercado');
    expect(sector).toBe('gastronomía, café, catering');
  });

  it('detects gastronomía from a café request', () => {
    const sector = detectSector('sitio web para una cafetería');
    expect(sector).toBe('gastronomía, café, catering');
  });

  it('detects belleza from a beauty salon', () => {
    const sector = detectSector('quiero una web para mi salón de belleza');
    expect(sector).toBe('belleza, bienestar, suplementos');
  });

  it('detects belleza from a barber shop', () => {
    const sector = detectSector('página para una barbería');
    expect(sector).toBe('belleza, bienestar, suplementos');
  });

  it('detects comercio from a retail store', () => {
    const sector = detectSector('crear una tienda online de ropa');
    expect(sector).toBe('comercio, tienda, retail');
  });

  it('detects oficios from a construction request', () => {
    const sector = detectSector('web para una constructora');
    expect(sector).toBe('oficios, construcción, limpieza, transporte');
  });

  it('detects oficios from a plumber', () => {
    const sector = detectSector('sitio para un plomero');
    expect(sector).toBe('oficios, construcción, limpieza, transporte');
  });

  it('detects turismo from a hotel request', () => {
    const sector = detectSector('landing para un hotel boutique en Roatán');
    expect(sector).toBe('turismo, aventura, hotelería');
  });

  it('detects turismo from a diving center', () => {
    const sector = detectSector('página web para un centro de buceo');
    expect(sector).toBe('turismo, aventura, hotelería');
  });

  it('handles English keywords', () => {
    const sector = detectSector('website for a dental clinic');
    expect(sector).toBe('salud, legal, financiero, profesional');
  });

  it('handles mixed English/Spanish', () => {
    const sector = detectSector('create a website for a restaurant de cocina fusión');
    expect(sector).toBe('gastronomía, café, catering');
  });

  it('falls back to comercio for unknown requests', () => {
    const sector = detectSector('hazme una web para mi mascota');
    expect(sector).toBe('comercio, tienda, retail');
  });

  it('returns fallback for empty message', () => {
    const sector = detectSector('');
    expect(sector).toBe('comercio, tienda, retail');
  });

  it('is case-insensitive', () => {
    const sector = detectSector('CLÍNICA DENTAL EN TEGUCIGALPA');
    expect(sector).toBe('salud, legal, financiero, profesional');
  });

  it('handles accents properly (clínica vs clinica)', () => {
    const withAccent = detectSector('clínica dental');
    const withoutAccent = detectSector('clinica dental');
    expect(withAccent).toBe('salud, legal, financiero, profesional');
    expect(withoutAccent).toBe('salud, legal, financiero, profesional');
  });
});