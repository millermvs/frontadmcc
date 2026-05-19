import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  VisitanteExternoRequestDto,
  VisitanteExternoResponseDto,
} from '../models/visitante-externo.model';
import { PaginacaoResponseDto } from '../models/paginacao.model';

/**
 * VISITANTE-EXTERNO.SERVICE
 *
 * Comunicação HTTP com o backend no domínio de Visitantes Externos.
 *
 * Endpoints consumidos:
 *   POST  /api/v1/visitantes-externos              → registrar()
 *   GET   /api/v1/visitantes-externos?idEquipe=X   → listarPorEquipe()
 *   GET   /api/v1/visitantes-externos/{id}         → buscarPorId()
 *   PATCH /api/v1/visitantes-externos/{id}/validar → validar()
 *   PATCH /api/v1/visitantes-externos/{id}/recusar → recusar()
 */
@Injectable({ providedIn: 'root' })
export class VisitanteExternoService {

  // =========================================================================
  // INJEÇÕES
  // =========================================================================

  private http = inject(HttpClient);

  // =========================================================================
  // URLS (do environment — nunca hardcoded)
  // =========================================================================

  private api = environment.api.visitantesExternos;

  // =========================================================================
  // MÉTODOS PÚBLICOS
  // =========================================================================

  registrar(dto: VisitanteExternoRequestDto): Observable<VisitanteExternoResponseDto> {
    return this.http.post<VisitanteExternoResponseDto>(this.api.registrar, dto);
  }

  listarPorEquipe(
    idEquipe: number,
    page: number = 0,
    size: number = 20
  ): Observable<PaginacaoResponseDto<VisitanteExternoResponseDto>> {
    const params = new HttpParams()
      .set('idEquipe', idEquipe.toString())
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<PaginacaoResponseDto<VisitanteExternoResponseDto>>(
      this.api.listarPorEquipe,
      { params }
    );
  }

  buscarPorId(id: number): Observable<VisitanteExternoResponseDto> {
    return this.http.get<VisitanteExternoResponseDto>(this.api.buscarPorId(id));
  }

  validar(id: number): Observable<VisitanteExternoResponseDto> {
    return this.http.patch<VisitanteExternoResponseDto>(this.api.validar(id), {});
  }

  recusar(id: number): Observable<VisitanteExternoResponseDto> {
    return this.http.patch<VisitanteExternoResponseDto>(this.api.recusar(id), {});
  }
}
