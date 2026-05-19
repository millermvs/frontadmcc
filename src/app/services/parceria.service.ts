import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ParceriaRequestDto, ParceriaResponseDto } from '../models/parceria.model';
import { PaginacaoResponseDto } from '../models/paginacao.model';

@Injectable({ providedIn: 'root' })
export class ParceriaService {

  // =========================================================================
  // INJEÇÕES
  // =========================================================================

  private http = inject(HttpClient);

  // =========================================================================
  // URLS (do environment — nunca hardcoded)
  // =========================================================================

  private api = environment.api.parcerias;

  // =========================================================================
  // MÉTODOS PÚBLICOS
  // =========================================================================

  registrar(dto: ParceriaRequestDto): Observable<ParceriaResponseDto> {
    return this.http.post<ParceriaResponseDto>(this.api.registrar, dto);
  }

  listarMinhas(
    page: number = 0,
    size: number = 20
  ): Observable<PaginacaoResponseDto<ParceriaResponseDto>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<PaginacaoResponseDto<ParceriaResponseDto>>(
      this.api.listarMinhas,
      { params }
    );
  }
}
