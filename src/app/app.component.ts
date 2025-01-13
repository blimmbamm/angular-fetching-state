import { AsyncPipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  BehaviorSubject,
  catchError,
  delay,
  fromEvent,
  map,
  Observable,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [AsyncPipe],
  templateUrl: './app.component.html',
})
export class AppComponent {
  DUMMY_DATA = [
    'Hello world',
    'Something',
    'Something else',
    'Still something else',
    'Yet another string',
  ];

  // Mocks an http function:
  fakeQueryFn(args: { index: number; letItFail: boolean; delay: number }) {
    return of(this.DUMMY_DATA[args.index]).pipe(
      delay(args.delay),
      map((value) => {
        if (args.letItFail) {
          throw new HttpErrorResponse({
            error: new Error('Failed by construction, hehe!'),
          });
        } else {
          return value;
        }
      })
    );
  }

  fakeQuery = this.query({
    httpObs: this.fakeQueryFn({ index: 0, letItFail: false, delay: 1000 }),
  });
  failingFakeQuery = this.query({
    httpObs: this.fakeQueryFn({ index: 0, letItFail: true, delay: 2000 }),
  });

  // Wrapper without params:
  query<T>(args: { httpObs: Observable<T> }) {
    const loading$ = new BehaviorSubject(true);
    const error$ = new BehaviorSubject<HttpErrorResponse | null>(null);

    const data$ = args.httpObs.pipe(
      catchError((error: HttpErrorResponse) => {
        error$.next(error);
        return of(null);
      }),
      tap(() => loading$.next(false))
    );

    return { data$, loading$, error$ };
  }

  // Wrapper with params:
  parametrizedQuery<S, T>(args: {
    paramsObs: Observable<S>;
    httpObsFn: (params: S) => Observable<T>;
  }) {
    const loading$ = new BehaviorSubject(true);
    const error$ = new BehaviorSubject<HttpErrorResponse | null>(null);

    // Observable for the actual data.
    // Is set to null initially and if params observable emits value
    let data$: Observable<T | null>;
    data$ = args.paramsObs.pipe(
      tap(() => {
        error$.next(null);
        loading$.next(true);
      }),
      switchMap((params) =>
        args.httpObsFn(params).pipe(
          startWith(null),
          catchError((error: HttpErrorResponse) => {
            error$.next(error);
            return of(error);
          })
        )
      ),
      map((value) => {
        // Set loading to false if either data is there or error occurred and
        // return null in case of error, data otherwise:
        if (value) {
          loading$.next(false);
          if (value instanceof HttpErrorResponse) {
            return null;
          } else {
            return value;
          }
        }
        // If data is not there yet, return null:
        return null;
      })
    );

    return { data$, loading$, error$ };
  }

  route = inject(ActivatedRoute);
  router = inject(Router);

  navigate() {
    this.router.navigate([], {
      queryParams: {
        index: Math.floor(Math.random() * this.DUMMY_DATA.length),
      },
    });
  }

  paramsObs = this.route.queryParamMap.pipe(
    map((queryParams) => Number(queryParams.get('index')))
  );

  fakeParametrizedQuery = this.parametrizedQuery({
    paramsObs: this.paramsObs,
    httpObsFn: (index) =>
      this.fakeQueryFn({ index: index, letItFail: false, delay: 1000 }),
  });
}
