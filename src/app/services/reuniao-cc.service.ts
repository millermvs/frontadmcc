import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ReuniaoCCResponseDto,
  AgendarReuniaoRequestDto,
  ReagendarCancelarRequestDto,
  ValidarReuniaoRequestDto,
} from '../models/reuniao-cc.model';
import { PaginacaoResponseDto } from '../models/paginacao.model';

@Injectable({ providedIn: 'root' })
export class ReuniaosCCService {

  private http = inject(HttpClient);
  private api = environment.api.reunioesCC;

  agendar(dto: AgendarReuniaoRequestDto): Observable<ReuniaoCCResponseDto> {
    return this.http.post<ReuniaoCCResponseDto>(this.api.agendar, dto);
  }

  listarMinhas(
    page: number,
    size: number
  ): Observable<PaginacaoResponseDto<ReuniaoCCResponseDto>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    return this.http.get<PaginacaoResponseDto<ReuniaoCCResponseDto>>(
      this.api.listarMinhas,
      { params }
    );
  }

  buscarPorId(id: number): Observable<ReuniaoCCResponseDto> {
    return this.http.get<ReuniaoCCResponseDto>(this.api.buscarPorId(id));
  }

  reagendarOuCancelar(
    id: number,
    dto: ReagendarCancelarRequestDto
  ): Observable<void> {
    return this.http.patch<void>(this.api.reagendarOuCancelar(id), dto);
  }

  validar(
    id: number,
    dto: ValidarReuniaoRequestDto
  ): Observable<ReuniaoCCResponseDto> {
    return this.http.post<ReuniaoCCResponseDto>(this.api.validar(id), dto);
  }
}
