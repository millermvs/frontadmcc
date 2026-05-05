import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CicloSemanalResponseDto } from '../models/ciclo-semanal.model';
import { PaginacaoResponseDto } from '../models/paginacao.model';

@Injectable({ providedIn: 'root' })
export class CicloSemanalService {

  private http = inject(HttpClient);
  private api = environment.api.ciclosSemanais;

  /**
   * listar(idEquipe, page, size)
   *
   * Lista os ciclos semanais de uma equipe com paginação.
   * HTTP: GET /api/v1/ciclos-semanais/equipe/{idEquipe}?page=0&size=20
   */
  listar(
    idEquipe: number,
    page: number = 0,
    size: number = 20
  ): Observable<PaginacaoResponseDto<CicloSemanalResponseDto>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<PaginacaoResponseDto<CicloSemanalResponseDto>>(
      this.api.porEquipe(idEquipe),
      { params }
    );
  }
}
