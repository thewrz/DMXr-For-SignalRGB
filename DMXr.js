export function Name() { return "DMXr"; }
export function Version() { return "1.2.0"; }
export function Type() { return "network"; }
export function Publisher() { return "DMXr Project"; }
export function Size() { return [1, 1]; }
export function DefaultPosition() { return [0, 0]; }
export function DefaultScale() { return 8.0; }
export function SubdeviceController() { return false; }
export function ImageUrl() {
	return "https://raw.githubusercontent.com/thewrz/DMXr-For-SignalRGB/main/docs/images/fixture-icons/other.png";
}

/* global
controller:readonly
discovery:readonly
serverHost:readonly
serverPort:readonly
additionalServers:readonly
enableDebugLog:readonly
udp:readonly
device:readonly
service:readonly
BIG_ENDIAN:readonly
*/

var FIXTURE_ICONS_BASE64 = {
	"blacklight": "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABmJLR0QA/wD/AP+gvaeTAAACvElEQVR4nO2ZMWsUQRTH/5OYa5KonSgGrCwUNRgw0dRiE00iQQvx64gJIsTgNxCLVIZ09oGACnZiVBAuRuzUWJgL+LPYFc/J7Zjb2bk78f1gYOfm7Xv/ebszszMnGYZhGIZhGMZ/ietEEOCEpFFJnyStO+cosHOSJiQdkfTSOfc+tbYDqQMAhyXdltT/6ydJ6wXm45Ku5NdngCXn3OeU+vpSOs85qt+dl6TjAdvmtv783qSUfgOAk5Ku5tVV59xGgamf5NCw89sKH1Ab8YPEvAFTkobzMhXhp6vxYxJwsODa56tX3w7Y+m3+vWXiB0k+Bzjn6somvYakuqS1gPlabtNQtlrUU+uLSQAF152ikvgxCdgsuP4DYETZ2l6TNCJpMuBzMrepSZrI742K/zdiErAsaSsvywE7f3wOB2z9ttDY3m/8IDEJmJR0LC+hp5qKSuK39SkM1CTN5OWypEOSBsoGr4hdSV8kPZW0IumJc65ReRRgDnhH7/MWuF5lx/uBe13uVBkWgPhlHrjf7Z5EMB/b+bkWTr8Di8A4MBid4UiAQWACeADstNA7W9Zxjb1jvg6crbgPlQGMApue5jdkk3fbzm62ePLnEuiulDwJ/pswV8bRY8/JYgK9SQCWPO2Pyjh57Tm5kEBrEvI5oZlXZZxse06GEmhNAjDsaS/cVrezTnbkALUifK2Fu8VQAra8+qnScjrPaa/+scgwlIDnXv1WaTmdx9f6rG0PwI0Wy+BoNfrSAZyvahmskW0smtns5SQAY8AHT/MGUG7HCsyylx2ydfYiEDrc6AjAEHAJeNjiyf8ArsUGWGiRhH+FO1VkuA+Y73ZPSnCXKrbDTYmYIdtY9DobwPR++9XukdiApGllR2Jjyv7L6/YX4jdl/yW8UHYktuKc2+2uJMMwDMMwDMMwDMMwDMMwDKM3+QndRGR8YaDC5AAAAABJRU5ErkJggg==",
	"blinder": "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABmJLR0QA/wD/AP+gvaeTAAAFaklEQVR4nO2aW4hVVRjHf5/WjIGDipfSlFS6aBcIKTUzmxzsoSzIKLqQaVk5SURYhPgQRGiiVvRQpnTTIrGsKCUwNYnyXupDkTe8UMGkOWKWTo3z72HtsX3W7HPO2ttzfIj9g/Ow1l7f9//Wt/det30gJycnJycnJycnJycnJ6cASWMlvSfpgKQWZeO4pO2SXpTUP0BzgKQ5knZEtlloiWJeIqk+S8frJC3PKF6KvyRNK6H7hKQTVdBdJqlraOfPk7ShCkHEmZGgO7PKmusldQlJwMtVDkSSTkkaFdMcLantLOjOL9f5fur4rm+UdL2kmqBHqKPPbpImS2r2/K6OtVnrXTsiaZKkbhk1a+SSusnze1JS31KGjZ7BboW+O+WDqlfhXW6V1FtSH7knop02SWMqpNlV0h6vT4/F23TybK70ygvN7HglgjGzdcD3sarOwFDgci+OrWb2dYU0jwOLvOqr4gU/Ab288oFKBBJjv1fuDfT06g5WWHNfguZpzvEumldWhYNp88r+DUhqc6b4fSjoo5+AcK/SUGA8MBDoDjQB24CVZnYkq98ymj2BW4GrgfOBZtxTtcLMfsriM3UCJA0D5gE3FWnSIuk14HkzO5olqATNHsBzQCOQNBvNlbQGeNrMtqfxnfQIlgpkErCe4p0HqAWeAjZLGpLGfxHNIcBm4EmSO99OA7BR0oNp/AcnQNIE4E1cB0O4BFgj6cI0AXmaFwCrgIsDTWqBtyXdHaoR9ApEgbxDx4StAlYAv+M6PBEYHLveD1gA3BYakMdbwACvbi+wGNiDm7XGA+Ni1w1YJGmdmf2WSk1u0xDnrqj+Va/+hKQ7EuxrJC1UR0YX8x/94iyL2o5J8POGpHMTdCfIrfLivBJdS/TfTtlXQFJn4B6verqZfeK3NbO/ganAOu/S/eV0ErjPK68FGs3snwTdj4FnvOp7o9hLEjIGXEHh4uEQsLBYYzNrA2Z71fUBOj6+zazIdzFex72K7fTBrTJLEpKAfl55q5m1lrHZ4JWzDIS+7qZSjaOYtqTVTTUNnmX8VWlVCEnAr175GknlZo/rvPLP4SGd5hevPLJU42hwvDatbkgCfgDi00lv3EBXLJBOwEyv+qsAHR/fZmbkuxiPU7ixagJ+LCdSNgFmdgpY6lXPk3Sn31ZSLW6A9Pfz75fTScC3qQcWKOFgJpqu53jVH5QZNIHwvcAsYDJQF5VrgY/k1t+fA4eBS4EHgEGe7Wdmtj5Q5zRm9o2klbjNTzuPAA2SlgC7cE/j7cBYz/xYFHNZghJgZk2SJgLLKXxqGqJfMQ4Cj4ZoFOFh3MgeXw0Oxm2MiiFgipkdChEIngXM7FPcU9ASaLILuNnMmkI1EjSbcMvc3YEmJ4FJZvZhqEaqadDMFgMjgNUlmrXgtsvDzWxnGv9FNHcCw4GXKJ38L4ERUYzBpD4PMLMdwDhJl+Hez0FAD9yo+x3whZk1p/VbRvMoMF3SC8AtwDD+OxDZhzsQ2ZXFd+YToejOnPEdTqnZjJsdsswqifgJKHl+VgH8Vy5pmqr06rTkOaefgMNeeWCFg/GnyEN07PBFZ0EzGUlTvb3zXkl1RQ1SIPelOU6rpF5yH0daY/Vtkm6skGZd1Ic4xadlSX0TDhY2SbohaQUWGER3SVMkHfX8roq1We1da5b0kKTuGTVr5A5Utnh+T8qdbpU0nq/qc0rSyJjmKBV+HqsWc0Oy10XuU3I1eTZBd0aVNb+V26sEPUJd1fH8rhL8KamxhO40uT9RVJqlyvKRV+6L7mJJ+5X9LzLHJG2TNEsBR+SS+kuaLfe3mj8yarZI2ifpXVXoS3NOTk5OTk5OTk5OTk7O/4l/Af/FKwyrilgZAAAAAElFTkSuQmCC",
	"color-changer": "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABmJLR0QA/wD/AP+gvaeTAAAENklEQVR4nO2aTYgcRRTH/yWy2WA0K1ExYMQ1+HGIKKLZQwwRD4rm4AfrWfEQFSUE8RbIQRHJIcRD1quCCAoeDCuCKOhpEQlRowHZFUUdNDEBNW5WN+L+PHTL9ryp2anq7upO2PnBwPTUe+//6nV3VXX1SAkBtgHbUrWf1wBTLHPQ034won2qmaxrAthJN/Mem4VC+4Knfd7E2NlM9hUBxoCOSX7GY9eFp33GmHSAsWZ6UQHgdZP4P8AdHrtBBbgNOGfMXmumFyXxXPoAL/SxXbEAuc2LnngPpe1FSYD1wE8m2ePAaB/7kAKMAMeM6c/A5Wl7UwICL/2C/cAC5HZJb4WL6whCNkI/Zn4+LGkcGA+M8egKzdOSHikcPw4cds69G5dpL65qAOASSd9LurJqrEhOSRp3zp2tEuSiGhKZUvOdV655qAXdZYDdnlG6aZ6p0ofStwCwSdKspOIoj6Sjkr4LCDEq6eb8+zeS/g7wuV7S7erO+y9JNzrnOgH+9QHsN2fiN2B7A7o7cq0iL6fW9SVi52c7C6TUfsJof9GUdjGJMyaJ9Q1qjxntM2VjVRkDuhYvzrnKU2ob+nVMgxc0q74AtSyFYyBbOd6rbDq7Jv+5o2z6/MA517M5cl5iVyMB9leQbXMtWN8CC8ABYEPd+rUTkwCwHfh1hY5bTgJ31aWfhNAEgPuBxYjO/88icF9V/UEknQaBmyR9Juky0/SDpHckfZ0f3yJpUtK1xu53SVudc3Nl9JMScgaA943Zv8BeYMRjOwLsy22KTJfVT8qgBIAJz2X9dEDcZz1+d8bqJyegAAeMyccRsT8yvvtj9ZMTUICjxuTBiNgPG98jsfrJCSiAnfaCd42Aq4zvyVj9UFIuhe3IH/PEZm2TPWmmLIA9a5sifK3tiYq59CVlAezc/UCEr30ROlsxl/oJGAP2GJMfgXUBcS+l9+Xq7lj95AQUYCNw1phN0+dVWe6zFnjP+MwDV8fqJyckAeAlawccAXZ4bO8GPvfYl365GkLqZ4FRSZ9ImvCE6Gj5WWCLlvcGisxIusc5t1hGPymhZ4DsVrA7yCF8iefSj9VPRkwCwDrgTWApoONLwBsMGDAvqAIUfCaAt+ndUgf4A3gL2JpK30cr2+LAGkk3KFvwoGw8mPPd6yn0u/zKONWZQNv6q35bvEoBus4A0NgVANi8W3kaPG2Or6sQKxardapsoCoF+MocP1chVizPm+NjDWpnAE95prJDwOaEmpuBVz26u8rGrDILrJF0XFKyDgcyJ2mLc+5cGefSt0A+Z09K6vkjdIP8KWmybOdrgeyPjN96LsvUzAK3ttbxImQvNZ4k284+kbDTvwAfArvwvFwpQ7OPkAWg5cfZnOFKsO0E2mZYgLYTaJthAdpOoG2GBWhRe6nP90ZpswCf9vm+OiB7X/BK/tnYdj5DhqxS/gN+QtH0RB7dTQAAAABJRU5ErkJggg==",
	"dimmer": "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABmJLR0QA/wD/AP+gvaeTAAAEg0lEQVR4nO2aW4hVVRjHf59NWtrVysuLkYKaRFFBU0MqFSG9REE6UIJRVCDRQwRdCKMoFCLSqLBeglLQt25QD0H0oPRUScEUdoEwBLOMyvIy06+Hs8sza84+Z+9zme2M84cN31p7f9/6f/+999prr7VgClM4pRFVNawuBDYC5wH7gP3A98AQ8FlEHK2K27hAHTIff6kfqevV2VVz7QnUI00EqMdR9U310qo5dxXZHS6DEfUNdU43eVTZB9wPLAIuAGYAPwBLgH7g4iauh4D1EbGjGzyqFuAEkYjX684tAlYD64ClOSFeAx6KiGOd8JjWiXOvEBHfRcQmYBlwO/Blg8seAN5VZ3XSVpUCmGP/j4gwIt4GrgIeBv5OLlkFfKie2S6JKgU4kGOPQUQMR8SLwLXA3uT09cAO9bQu8+st1Jnqddkxs4TfbHV3g6/E073ke1JBPVf9osFn8oaquRWGukBdmx0L2vCfr/6UiPCNOqNMnCr7gOXAzOxYXtY5IvYDdwIjddWLqXWWhVGlALNy7MKIiE+ArUn1I+rZRWOclOOAkngS+LWuPBu4r6jzhBcgIn4DXkqq7y3qP+EFyPAKUD8kXqZeWcRxUggQEQeBD5LqW4r4VinAcI7dLt5LyjcWcapSgKEcu118nJSv7kLM3kKdp87rUqxQf08GRi0nTyZFHwC1P0fG/ihd0sqvrzd0WkMdAC7L7K8iYncXwv6SlM9p5VDlE7A0x+4Efybls1o5VClAX47dCc5IykdaOUyaPiBD+sj/0cphsgmwMCnvb+UwSoDsH3tXNrnQaF5+lzq/q5S7BPV8IOX2bSv+6RPwKDDQoP6/aweya05GtJpTaMi/ylfgcI7dLlZ1HGE8X4FOp8SSWKerBxpwnjCvcEdQB5NkD6rTq+bVFNamxQeyo/C0eIM4oe5JBHi5qH9lQ2HgZmBuZl8EvNNmnHuAy+vKI8CWos5VdoJzcuzCUOcCm5LqHRGR/hTlokoBIscuBHUasB24sK76MPBEmThtCaDeqn6tfq5e006MLmALcFNS90xE/FgmSOk+QB0EttX5bqW2ejsuUAN4DngwPQWUSh5KCtAgeait7IwLrC17vUqt40sRwFuqEbGzaMzCAuQkP0z7Q2M58e433B+QtL+E2jvfbK6vD9imUlSEQn2AupqxyY8Ad0dEu5+vQvsDrK0EPwvsYWzyPwOPM3pWuQ/Yrq5tk9cYAqvV48lAY1i9q8O4TfcHqEvUjeqhnKHtXnVxdu0dORw7E6FXySdtTLe26eEKdY36gmPX/lPsVM9J4nRXhF4nr2628U9XM+xT1zSJOdiA83Fr/Vcpcv1dCdS8jTLJH1AfU1tOcuaIcMwy4xV1Qy+Tz9pohWFru0nXWXIrXI4IG8oEWFF3h7qefNZGiiH1ffV59TZrU1ydxB/M7rxZLivKBlipPqX2d0KkSfxR6FEb/VkOK/OuqXKr7KikI6ISLpNtWrw0pgSomkDVmBKgagJVY0qACtv+J8ceV1QpwKc59qkBa8twm7Nj8i1XTWEKEwP/AnpgMnPpP0WnAAAAAElFTkSuQmCC",
	"effect": "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",
	"laser": "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABmJLR0QA/wD/AP+gvaeTAAAC80lEQVR4nO2YPWtUQRSGn7OY+FGIxEaDBBURzYcfhTaipDMEUgbRStQfINb+ADt/QRBLtUkT0kSI2liooIliF4lg0kQFITEbktdi78a7s/fu3c0uuzubeWBhZ+7MvTPvOWc+DgQCgUAgEAgEArsSa/UAmoGkXuA0sALMm5mKz/a0bFRNQtJBYBTIxarnin9yZT06jz5K53k4/tBbD5DUB1yLiq/NbDGlaa9TXokXfPaAq8CB6DcsqdttIMmAI071j3jBZwHiC/g+YDChTU/0rMg68DPewGcBvjjlcwle4Lr/UnwHAL8FmKdg0SLdlHvBUae85L7EWwHMLE9sO4vY9oJq4h88FiCikhdkxj94LkCGF2TGP3guQESaF2TGP3SAAGleABxz6sriHxIEkHRC0qiknsYMsSkkeUHcA9ZIiH9wBJA0DHwFpoBlSdOS7rS7GClesEZBlFXgVVL8g3MdlvQEuJ3QbgN4CbwAJs0sUc1WEi18N4G9seppM/teqZ8bAh9T2nUBI8AEbeoZkRfEx78F/K7pJZJykh5I+qzqyEdi3G0HMSSZpCFJw1ESBEkjkj5EY12U9EjS/mKf1IyQpJPAGDAOXKni+5vAO+AXhdjL1zOZBnEcuJRQPwWMmZmqSolJ6qcgxDgw0LDhtZYbZva85pxgB4kxYWb3vD8I1UtVKbEOsnqcGai8CA7wf9L9VbywHRfBU8DFhPoZYMTMNktqO3QbvC7pvaR1Sd8kPZTUVezjngTvA48zvtO2p0JJF4DLUXELeGZmfyr1cdeA8ynt2nbSRaKjcHz8OeAQUJMAT4FbFG5TbT9ph0FK7wHrwHJWpxIBzGxW0hngLPDWg0kD29YfcqrnzGwjq2/ZNmhmC8BCg8bWLFzr5ynkCDLx/iCUYv1P0e0wE+8FoA7rg+cC1Gt98FwA6rQ+eCxAI6wPHgtAA6wPfgvgXtBqtj74LUA8zf2XHVgf/BbgDYWc/yowuxPrBwKBQCAQCAQCgUBgt/IPA2ip0CZFMLoAAAAASUVORK5CYII=",
	"moving-head": "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABmJLR0QA/wD/AP+gvaeTAAAFRklEQVR4nO2bW2wVRRjHf58S2kqUVrkUBDUQBHwQAsGoqBS8JD74iI9GCYjx8qrxGoNG5NVoTDD6pjE8GJ7UaAWCoAVFIFIFCkpAQhQj4XbaguXvw+xJl+k52073ckzYX3LSnd1vvvnvtzO738xuoaTkisaKblBSE7AQaAOaot19QD9wHug2s7NF6cktAJImAbcBNwEngU4zuyjpMWBGQtWzwHtm1idpfFT/TzP7Kw+dY7J0JqkZWATMAybEDs0ALkr6Brh5GDfXAlMlnQaeJOolkk4Ce4EfzKw/K82ZBUDSAuBBoKWOSauZSdIBXM+oRwU4AcxncIgATAQeABZL+h7YkUUgMgmApFbgEeoPqX5gR7T9GfArLlDVE2gCmqPtfWbWK+k4oBo+W4BlwHxJ682sL432rHpAM0OFDgC/Ad3A/qpQM/sX+Hk4h2Z2VNInwB24IXS1Z3I9MGskvpIYdQAkLQJmAj1mtkvSHly3rQBdwM60V8fMeoAeSS24e8tdDA4xAX+n8Q+jfApIWgosie362Mx6JF0D9JqZ0gqr024TLhBTgX3AAaADmALsNrPuUJ/BPUDSDOA+b/cEXE+ohPoLIbrpbYtpWQzcGxVnSqqY2e8hPq8KMZZkwENc3nMqpByHKWiLbVe1BREUAGA60B4rC/jUzM6FNpwReyINVaZImh7iIDQAfga338yOxndImi5pnaS9ks4pPeck7ZH0tqRp8bbM7A9gv6dpZsgJhQagzSsfihckPQccBJ4HbgfGBfqvxThcZvkCcFDSM0kaamhMJDQAvV75ZHVD0svAOwwmNHnQArwr6cVaGiJ8jYmEBmA7cAy4AHRVu7+ke4A3An2l4U1Jd4NLmHB5x4VI2/YCdTgkbfLG7T+SHo9mc2l9j5f0hKRTXhudWWhPPR2Wm/aeYLA3Cegws60JdRYCDzN4wzoMfGFmuxLqdACbYpoHgClm5g+BYpHU4V2ZnQm2syVtTrjjd0q6NaH+j569n5AFE3oPqMUNXvloLaNozHbhUtd63A90SbqzzvEjXnniCPQlkkUAfB+XfANJ7cBGoHUE/tqAjZIm1zjm+06tP4sAjITXGHq1PgdWAquAL71jk4FXC9CVHknLvXG5wTveJOmMZ/N6DT9rPJvTksZ6Nhs8m+Vp9RfRA+bh1vmqHKN2zrAGOB4rXxfVzZUiAtDulXeb2YBvFK0U/TRM3cwpIgBnvPLUBNsbvfLpjLUMoYgAdOOSlioLJS3xjSQtAxbEdg0Av+SsLf8ARJnalvgu3GNuhaTW6LcSt1ocZ5OZpV7zG44iH4PxZ3gr8CFwKvp9AMTnDZeiOrlTSADM7DvglYAqL5lZV1564mQRAP9FZs1sz8zWAs+SPF+vAE+b2bo6x/3FDv8GWzyS5njJyfk6aWzVfpqktXLLXGejJGm3pLck+U+BeL12SRWvrVn5nFUgkg57wr5NCsIo/LdL2ua10ZOF70xej0t6Cnjf292LW67qxy1chr4lagbm4N4bTmLoUttqM1sfrjYHJI2R9LWK4ytJ/rvCxiL3PO8s6ORHMq0uHrmesFrSoRxOvEfSKmV85fP8RMZ/QfpooIvLptVmlovWwgIQegJp64+UolLh/y1lABotoNGUAWi0gEZTBqDRAhpNGYBGC2g0V3wAsvpWuANYQcLnMfJemY2ijXj9PuAjM9uSxidk84HELbgvNscOY5o1F4DZZnYkjZMshsBcij95ojbnpnWSRQC24j6NK5qDUdupyGpNcBywlKH/LDE7+ntglK7r1e8FNpvZ+VH6LSkpKSkpKSnhP2wJSMmPjsJiAAAAAElFTkSuQmCC",
	"other": "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABmJLR0QA/wD/AP+gvaeTAAADvklEQVR4nO2a3YsPURjHn2O9b+R1V3kpUSgb4YJwIbGpVV4uhH/AncSdK+V+ufRy52ojIfKSlrDkgkLYTesCK6wo5d3ux8UM/fbZ89tm5pwz85P51O/i7M55vt/nmTNzZs4ZkZKSkpKS/xeTlxAwR0SaRWS1iMwXkVkiMi7+9ycReSEinSJyU0QuG2Oe5+UtGEAdsBO4TTr6gQ5gO1BXdB6ZAJqBrpSJ2+gE1hedT2KAscBxD4lrDgPDi85vSIAG4F6VBPqAa8BeYCXQCIyIf43AKmAfcD0+1sYVYGLReVqJk++0mP4FHCW6CSaNNQc4FvfVPK65IhANe9uZfwosdYi7DOi2xL1MLV0O8dnSXADqPcSeQnTpaA758O4M0d3elvwIjxojqxRhpS+NrMbqGDzVPfFx5i1aU4DnSuuWb520pnYoQ7+AJQH1VhA9JFWyKZReEkP6Ce9IDpqnamIUAHPV2egjxVTnoDtP6fYDs7PGG+bgZb0MfJm6YYzpdoiXCGNMl0QvTH//JNFLViZcCrBKtS84xEqL1tJeEuNSgAWqfcchVlq0lvYSHuC9uhk15Kg9TWm/yxrLZQSMU+2PDrHSorXGZw3kUoB+1c5z4UJr9WUN5FKAD6o9ySFWWvTbYObR51KAt6o93yFWWrTWm6yBXApwX7WXO8RKywrV1l4S41KAu6q9xSFWWraqtvYSHqJlLL1ik3nxI4XuMqX5M88pWJu5pMycyUHznNK8GFpzKDPrGMzGgHobLHprQ+klNdWhDL0EpgbQaQBeKa1iF0RiY4vj67CSdmCUR43RDF4S+wEs8qXhBHDQMjTP4mFdkGjfQF/3AAd8ePcC0dpgu8VkGw57e3HcNkvcqy5xgwBMAO5XKULqkRAnf8IS7yEwOUQOzhA9G9h2h9qAxFvxgAFOWuI8pag5PynADOy7ObtTxNhj6d8NTA/p3RtxEfR+wTdgYYK+TcB31bcTmJGHd28AM4FelcjJBP1Oqz69/1zyfwA2q2R+MMQNDJjK4GeK4jY+fAA8UgltG+LY7erYB6H95bHFfF5EKq/9/YB+nf2DXt0NvtSeRwGeqXZT/MvS1zsuCyJJ6S2ob20A1FumxCR0EWCbXZPLh5JxImtEZEzCLl9F5Jox5nM4VzUA0ddixX7lURRAa8Vwby3aT+4AXyoK8KUoH7l9LK0BGGDEmEK85DEN1jRlAUIFBlqAnmqTvOX4avQALaF8BrvugFci4msBo8cYE+SVuLwEAsbeJSKvPcR5HccqKSkpKSnxzG98TZIWPB0nPwAAAABJRU5ErkJggg==",
	"pixel-bar": "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABmJLR0QA/wD/AP+gvaeTAAADM0lEQVR4nO2ZzWsVZxTGfye9JKUqJrGaqit10VKoBpPakoWkq9QPUHFXKHRREEL/BUMV/wZx0Z0uCoJ00TQVWr9WLbSxBlFRXPhBNELzJUqbpnm6mLlmMrkzd2aS3KHm/Hbzvs+Z9znn3pn3Y8BxHMdxHMdxHMdxHMdxVhVWq1FSF7AP2AGsaaij5ecFcB8YMrPf450LCiDpXeAM0NsQa43nZ6DfzO5WG14VQFIPMAi0lmCskUwA+83sFwgLIOkdYATYWKKxRjIG7DKzsUrYMMDi5H8ALgDTjXS2AqwHjgKfRto6gOPAV0hqkTSthXxdhtOVRNLJWI5TkpqRtCfW8VDSG2UbXm4kVSQ9juX6YQXYHNMOm9m/NW6wjWBq3A68BYwDN4GLZjaxVH0YswY4COwE2oCXBFPYZTO7sxS9mc1K+g3YGmneUgGaY/ediQ1iwCGgD2iKdG0EPgF6JH1jZiNF9JFx3ge+IHhmq6wDOoFOSVeAb81MRfS1cgOam6hPL8EvmaRtAb6UtKmgHklvA8dYmEwtH3uL6NNILYCkduBIvZsQJPVZXn3k+nPgzQxxRyW1FdAnUu8f0E1gNgvvEVQ9s15Sm6QNYWwWWggeozz6rjRBJa2TxS/INIzsxqr6LSTsR1LIMwbhGIlkeQesNKovWZI+lXoFGM1xLwG3c+pHgSc5YgAWTYd1SM2hXgGGgdmMA90GruXRm9mEmY0D9zLGzAJXc+qH0wSpBTCzP4EfMwz0F3Aurz5yfR74J0PcUFiwvPpEsrwDvgeGgLmE/kngTJh8ET1m9gA4DUwlxMwRbM4Gi+jTqFBjdRS9CFdS30n6g2BHtYP5pe0IMGhmL4vqI3G3JJ0ADgAfAO3ML22HwqQL60PiU/RMrc3QI0n1psf/HQmboe7qdngq1nGibMPLjaRTsRwnJTVXzOxvSeeA/oh+QNIeggORyXIsLxutBAcifbH2s2Y2Uz0S6wBuEJyUrAaeEhyJPWsCMLMx4DDBgeHrzgRw2MyeQWQaDE9JPwYulWSsEfwEfGRmv1Ybkj6M7Gb+w8jaxnhbMZ4zPzVeL9uM4ziO4ziO4ziO4ziO45TMf2owvPH1b2NlAAAAAElFTkSuQmCC",
	"scanner": "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABmJLR0QA/wD/AP+gvaeTAAADdklEQVR4nO2Zy2tdVRSHv5VojAaCVdQ68VHQRnGg4IP6BgeCFq2DSh2JUJw4cCaICK3Q6si/oAULClJEFBz5bEujIOJIW1qC+Ki2KEURLEm0+Rycm+S6cx/n5p57Twz7gwt3v8767XXOWnuffSCTyWQymUwmk8lkMpl1g7pD/bnx21q3nqGhhvqyuuAyp+rWNRTUMfWAK1n/DlAvUw+1mPys+ljd+gaKukk93mLyZ9X7O42NHg3dBzwEbAZG+9DcivPACeDjiDjag6YtwHvAlUnTDLA1Ik70rawRW/tbeHhQ7FMvLKFru3quxfij6hV9T7zJ0CtDnPwiu7poel4932Lc2+p4lZOfUOeHOfMGc+olLfS0y/QL6i61p7C+oESfW4Hmx/E74CWKmK2SUWAvcH2jPAbcBkwvdlA3AO8CDyZj54CdEfFmxZqW4qyZg5UbWbZ1MLG1valt1Zm+EyPVSB8sFpn+C2AqaZoB7o6II6u9dpkQGArqXcA9SfUz6uXA68DFSds08ERE/DZoYQMNAYu9+171n5LJUSvM9GshBJ4DXqTcxkpgN/BURMxWYbzWEFCvAV4r2X0BeLrqTF/3E/AkMNFU7nRXAzhctYC6HXBzUu7mgLR/39TtgG7MJ+WednllqNsB3yblNLOPNf23Rf++qdsB7/Dfu9xpaTsG/F61gFodEBE/UG4VmAXeAq6qWsNa2AnuptDxAq31/AG8AZwGzgCoIxGxMBR1w3oZUu9UTyW2PlBvVG9RJ9VxdZv6rPqwelG/duvOAUtExJfA50n1gYg4GRHfRMSfwE0sH31dCzyuTvZjd804oCTpGcSlwDZ142ovWCYH/JKUb1d3tBDTL6PAHV1sH6O481c31Y0Dj6qHI2KmV6NdNxbqBMXy0/WQsmLmgQ0RcS7RMwI8ANyQ9Bd4PyJ+7cVI1xCIiL8ojqqGzZ508g09CxHxGfBV2sQqlsmyOWAPsL/Xi68SgX3Aq506RcTXwKcsh+LfwE8AvZwV9Pph5F6KDyNTDObDyHHgk4iY7ta5SdMksJFinzALPELxJJwFPmqsHm2p/OWiTtQpoPmAdBb4MCLOtBvzf1sGuzGXlBdXiOvaDVhvDvgeOJnUjbLysHWJdeWAiDAiDrFyhWg/ZnBy6kXdBGyhmOORiPixZkmZTCaTyWQymUwmk1kz/AvSprM1PuYmNwAAAABJRU5ErkJggg==",
	"smoke-machine": "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABmJLR0QA/wD/AP+gvaeTAAAExUlEQVR4nO2aXYhVVRTHf8uP0bQpRGucjFEzFGvAiiwmnJQeLCKSMjOkp8ISHyt6LQh66eNJIpGiD4TQIKIJSkTTXswelBKtBkqLaqwsx2n8Kvv3cM40+6x7zr1177nnDtP5Pc3ae5211153r7X32WegpKSkpKSkpKSkpKSkpKSkpIVI6pLUVeSYVuRgWUgyYBVwXdy0z8w+KGLsCUUMUo148nczOnmAG4oav+UBAO4Arndtx4savKUBkNQD3OyaB4G3i/KhZQGQtAhY6ZqHgNfNbLAoPyY1w6ikCcBSYFnc9J6ZfRX0X0pU9MIifA7Yama/NsOnLHLfBSTNBu4BOoLmU2b2Ytw/EXgYuCLov0A0+a/z9qcWua4ASYuJJt9WRa2H5OQBdmRNXtIMYBZwzMzO5+JoQG4BkNQNrKZyVZ0B+mKdGcBy138Y2J9hcyGwFpgInJC0Oe8g5BIASfOJfnk/+QPATjMbjuXbgMlB/2ngfTNTis1O4D6iyQPMBOYC/Xn4PELDAZA0FbiXUUchyuk+MzsQ6M0ErnWPfxgEJ7R5MbCOZCpdAH5u1F9PHivgdqA9kAW8Y2aHnN4tJLfdAeCzf2kTooCebMTRNBo6B0iaBSxxzXv95OPKf43T+zhj6XcA3Sm6B7xuHjR6EFrmbBwH9qboLQAuCuTfgSMZNm8iWUt+AHZ7JUl3Sfpe6ZyTdEzSm5JWVJtA3QGQNJnKX/UjM7uQor7IyYfN7K8UmxOAxa55T5ou8DKV2+kIbUAX8CCwW9K2uK5U0MgKuJpkkToJfJGh6x39MkOvA5gWyMPkU/XXADvigp2gkQDMdfKRjJyeCFweNhEt6zRmO/nbjF8fYEMVO2n0AM/6xkYC0Onkoxl6M0hukYNmdiZDd7qTT2QNbmZ9ZjbHUgCmAL1UHrA2xueLUTtZA8A/e/xK4FaiCYeHmIVO7gfSTmnTgPmBfBr4JmPIDqJj7wgDJIPwE3AIeNfMfqzme+x/O9FhbEHQvMHMNtd6FklrJX2XUWVbzVlJzyslp1Pm8aR7dlPYn5oCkp4C3gKurBmp1jAFeBzYpYzqHnDUyZeFQkUAJD0APN2Ac0XSA7xaQ8cX5kTaJ47C8ZJ6zj1wGthCVFD+cH0j+fpLDScmEUX+FNHWVo3pwCVE5/4/Xd9VwHqSOb1G0nIz21PDbm0krXL5MixpacOGc0RSu6T9zs83quivd7qvhP0+BXqdvMXMPs3L+TwwsyGi/A/xfoesdnL2rZOkrS5a6+r0s6lIanN+nkvRmSTpmZQdJHEF71+HJzvZ5/yYwMzOS4na1iZpWygDNwJz3KM7/VtlU26FW8SaGv2/ARt941j4MlQEA8CdZlbxYjXeAzAIbAKWmNm+NIXxlAL3B3+fJ3pTPGhmVevYuAmAmW2v57nxngI18QGoem4eKyi6Oks01WvLG/Jn+nn1Gm4y85xc9/cCH4DPnfyookuFscYTTs76vvDfkNQZXzaEfCKpV1K1D56FIGmBpJdSjreP1GuzIsclvQA81pCnxdIPdNf70TQtAFOBXUSXDWOdIWCZmdWdAhXboJmdJboIrWtfLZB+oLeRyUPtW+EVwEOM3gq3ug4MEN0Kbwdea8Y/TJSUlJSU/J/4GxFHwhMRonsOAAAAAElFTkSuQmCC",
	"strobe": "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABmJLR0QA/wD/AP+gvaeTAAADRklEQVR4nO2ZsWsUQRSHfxMwoMFCUkVR0ommMBYaSGNsLFSws7CQWFsYwfgf2EhACxsbkyCIWKhFWiGCEYJFUIwQG8XCKsbCRJMI+SxuVzeT2c25d7NzTO6DFJmZvfdmdr83c3tSmzZtQgMMARPAdaAjdD6VAgwC6/xjpMr4QVcb6Jb0WNKuTPOxKnMItgCAkTQp6aDV9TZAOtUD3MRNf+jcvAMMAGuOyX+LvggC+4BPOXf/WdX5VLraiffjknpzhrysLpsAFHgfv/8F3sfv/zbeB/NfqqAGJN4/1GbvkfTdGhqn/znejwGL0fuf4/1s0h63/zneLwG91L71ZXkaKk8vq457v0fSFWPMZ0mnrEvi8j/H+9tJX4fD/0q/AXqlwPvOpP94tP4XeZ8Z0zL+S02sAXV4nxKn/0XeZ8a0nP+mGR8CDEqa1uZXW68lDRljfmfG9Uuay4xZl3RZ0kYD4b8aY2YauL4xgG7gi3VXF4FDjrEjjqekGdwJMXcBBpiyktkAzueMn/S0AMtl59BoEbwh6ZzVNmaMmcoZP5fT3ijvyl5YugZQp/fWNR2SrkkaULnF75J01mr7KemkMWa+xOeVgzr2e09xxx2P/7DPmK4kDPDcSmIDuOA57rBj8o98xsxLZNv93kPMPmDZirkA7PUZ15VI4TnfU8wuYN6K+YuqD1C0vY/T+7q2QWBUku35kqQXJeOuSnpgjJkuiNknaVa1rS/lg2pb3krJuP8PtVdY64470Shr5OiD2/uVZFGaSj2HkSPafNhpFp2S8iZ0T9JRq+1qpYedlORuLHh4AgD2O+K5vJ/wNb96a0CXpNOSdjcQ64Sk0cz/H40xh604reG9D4Bb1l29b/W3xn7vC2DGmtwlq3/c8egPB0q3uQB72HqCPJDpb41zvi+AM9bkFjJ9Qc/5Vb2Pt98ET0t/i+sTbS56q5IuGmN+VJNaBeT5H7X3KXn+R+99isv/0N5nqaIG2P6/0U7wPsXhv/3LUHzep+T4H7/3KQ7/bYJ4n8V3DbD9zxKv9ykO/+P3PmUb/+P1PqXA/+DeZ/FZA1z+x+99CvBqx3mfha1H3YnQOVWKtQO8p/bVd+cA9AB3k7+e0Pm0adPGyR91FdfA5ri0TAAAAABJRU5ErkJggg==",
};
var serverHost = "127.0.0.1";
var serverPort = "8080";
var additionalServers = "";
var enableDebugLog = "true";

export function ControllableParameters() {
	return [
		{
			property: "serverHost",
			group: "server",
			label: "Server Host (manual fallback)",
			type: "textfield",
			default: "127.0.0.1",
		},
		{
			property: "serverPort",
			group: "server",
			label: "Server Port (manual fallback)",
			type: "number",
			min: "1024",
			max: "65535",
			default: "8080",
		},
		{
			property: "additionalServers",
			group: "server",
			label: "Additional Servers (ip:port, comma-separated)",
			type: "textfield",
			default: "",
		},
		{
			property: "enableDebugLog",
			group: "debug",
			label: "Enable Debug Log",
			type: "boolean",
			default: "true",
		},
	];
}

// --------------------------------<( UDP Protocol )>--------------------------------
// DMXRC binary protocol: 15-byte header + 5 bytes per fixture
// Magic "DX" | version | flags | seq(2) | timestamp uint64 BE(8) | count | [idx,r,g,b,br]...

var udpSequence = 0;
var udpEnabled = false;

function buildDmxrcPacket(fixtureIndex, r, g, b, brightnessUint8) {
	var seq = udpSequence;
	udpSequence = (udpSequence + 1) & 0xFFFF;

	// Encode timestamp (Date.now()) as uint64 BE — 8 bytes
	var ts = Date.now();
	var tsBytes = timestampToBytes(ts);

	var packet = [
		0x44, 0x58,                 // magic "DX"
		0x01,                       // version
		0x00,                       // flags (no ping, no blackout)
		(seq >> 8) & 0xFF,          // sequence high
		seq & 0xFF,                 // sequence low
		tsBytes[0], tsBytes[1], tsBytes[2], tsBytes[3],  // timestamp bytes 0-3
		tsBytes[4], tsBytes[5], tsBytes[6], tsBytes[7],  // timestamp bytes 4-7
		1,                          // fixture_count
		fixtureIndex,               // fixture index
		r, g, b,                    // RGB
		brightnessUint8             // brightness as uint8
	];

	return packet;
}

function buildBlackoutPacket() {
	var seq = udpSequence;
	udpSequence = (udpSequence + 1) & 0xFFFF;

	var ts = Date.now();
	var tsBytes = timestampToBytes(ts);

	return [
		0x44, 0x58,
		0x01,
		0x02,                       // FLAG_BLACKOUT
		(seq >> 8) & 0xFF,
		seq & 0xFF,
		tsBytes[0], tsBytes[1], tsBytes[2], tsBytes[3],
		tsBytes[4], tsBytes[5], tsBytes[6], tsBytes[7],
		0                           // zero fixtures
	];
}

function buildDmxrcMovementPacket(fixtureIndex, r, g, b, brightnessUint8, panTarget, tiltTarget) {
	var seq = udpSequence;
	udpSequence = (udpSequence + 1) & 0xFFFF;

	var ts = Date.now();
	var tsBytes = timestampToBytes(ts);

	var packet = [
		0x44, 0x58,                 // magic "DX"
		0x01,                       // version
		0x04,                       // flags: FLAG_HAS_MOVEMENT
		(seq >> 8) & 0xFF,          // sequence high
		seq & 0xFF,                 // sequence low
		tsBytes[0], tsBytes[1], tsBytes[2], tsBytes[3],
		tsBytes[4], tsBytes[5], tsBytes[6], tsBytes[7],
		1,                          // fixture_count (color)
		fixtureIndex,               // fixture index
		r, g, b,                    // RGB
		brightnessUint8,            // brightness
		1,                          // movement_count
		fixtureIndex,               // movement fixture index
		(panTarget >> 8) & 0xFF,    // pan high
		panTarget & 0xFF,           // pan low
		(tiltTarget >> 8) & 0xFF,   // tilt high
		tiltTarget & 0xFF           // tilt low
	];

	return packet;
}

// Encode a JS timestamp (Date.now()) as uint64 big-endian (8 bytes)
// Uses only basic integer math — no typed arrays (SignalRGB sandbox lacks them)
function timestampToBytes(ms) {
	var bytes = [0, 0, 0, 0, 0, 0, 0, 0];
	for (var i = 7; i >= 0; i--) {
		bytes[i] = ms & 0xFF;
		ms = Math.floor(ms / 256);
	}
	return bytes;
}

// --------------------------------<( Server Registry )>--------------------------------
// Multi-server support: tracks all discovered DMXr servers keyed by serverId

var serverRegistry = {};
// serverRegistry[serverId] = { serverId, serverName, host, port, udpPort, lastSeen, healthy }

var STALE_TIMEOUT_MS = 300000; // prune servers not seen in 5 minutes
var UPDATE_CHECK_URL = "https://raw.githubusercontent.com/thewrz/DMXr/main/DMXr.js";
var updateCheckDone = false;

function getServerUrlFor(server, path) {
	return "http://" + server.host + ":" + server.port + path;
}

// Fallback: first healthy server, or manual config
function getServerUrl(path) {
	var keys = Object.keys(serverRegistry);
	for (var i = 0; i < keys.length; i++) {
		var srv = serverRegistry[keys[i]];
		if (srv.healthy) {
			return getServerUrlFor(srv, path);
		}
	}

	var host = serverHost || "127.0.0.1";
	var port = parseInt(serverPort, 10) || 8080;
	return "http://" + host + ":" + port + path;
}

// --------------------------------<( Per-Controller Lifecycle )>--------------------------------
// SignalRGB calls these with the `controller` global set to the active DMXrBridge instance.

export function Initialize() {
	device.log("DMXr: Initialize v1.2.0");
	device.setName(controller.name);

	var iconKey = (controller._category || "other").toLowerCase().replace(/ /g, "-");
	var iconBase64 = FIXTURE_ICONS_BASE64[iconKey] || FIXTURE_ICONS_BASE64["other"];
	device.setImageFromBase64(iconBase64);

	if (controller._isMover) {
		device.setSize([3, 3]);
		device.setControllableLeds(controller.ledNames, controller.ledPositions);
	} else {
		device.setSize([1, 1]);
		device.setControllableLeds([controller.name], [[0, 0]]);
	}

	// Enable UDP transport
	try {
		device.addFeature("udp");
		udpEnabled = true;
	} catch (e) {
		udpEnabled = false;
		if (enableDebugLog === "true") {
			device.log("DMXr: UDP not available, using HTTP fallback");
		}
	}

	controller._lastR = -1;
	controller._lastG = -1;
	controller._lastB = -1;
	controller._lastSendTime = 0;
	controller._lastPan = 0xFFFF;
	controller._lastTilt = 0xFFFF;

	if (enableDebugLog === "true") {
		device.log("DMXr: Initialized " + controller.name +
			(udpEnabled ? " (UDP)" : " (HTTP)") +
			(controller._udpIndex >= 0 ? " [idx=" + controller._udpIndex + "]" : "") +
			" -> " + controller._server.host + ":" + controller._server.port);
	}
}

export function Render() {
	var ctrl = controller;
	var srv = ctrl._server;

	// Color sample: movers use center pixel (1,1), non-movers use (0,0)
	var color;
	if (ctrl._isMover) {
		color = device.color(1, 1);
	} else {
		color = device.color(0, 0);
	}
	var r = color[0];
	var g = color[1];
	var b = color[2];

	// Throttle to ~60 Hz
	var now = Date.now();

	if (ctrl._lastSendTime && now - ctrl._lastSendTime < 16) {
		return;
	}

	// For movers, compute centroid from 3x3 grid
	var panTarget = 0xFFFF;
	var tiltTarget = 0xFFFF;

	if (ctrl._isMover) {
		var totalBrightness = 0;
		var weightedX = 0;
		var weightedY = 0;
		var minBr = 999;
		var maxBr = -1;

		for (var gy = 0; gy < 3; gy++) {
			for (var gx = 0; gx < 3; gx++) {
				var px = device.color(gx, gy);
				var br = (px[0] + px[1] + px[2]) / 3;
				weightedX = weightedX + br * gx;
				weightedY = weightedY + br * gy;
				totalBrightness = totalBrightness + br;
				if (br < minBr) minBr = br;
				if (br > maxBr) maxBr = br;
			}
		}

		// Only compute movement if brightness is non-uniform (threshold of 5)
		if (totalBrightness > 0 && (maxBr - minBr) > 5) {
			var cx = weightedX / totalBrightness;
			var cy = weightedY / totalBrightness;
			var panNorm = cx / 2.0;
			var tiltNorm = cy / 2.0;
			panTarget = Math.round(panNorm * 65535);
			tiltTarget = Math.round(tiltNorm * 65535);
		}
	}

	// Skip if unchanged (for movers, also check pan/tilt)
	if (r === ctrl._lastR && g === ctrl._lastG && b === ctrl._lastB) {
		if (!ctrl._isMover || (panTarget === ctrl._lastPan && tiltTarget === ctrl._lastTilt)) {
			return;
		}
	}

	ctrl._lastR = r;
	ctrl._lastG = g;
	ctrl._lastB = b;
	ctrl._lastSendTime = now;
	if (ctrl._isMover) {
		ctrl._lastPan = panTarget;
		ctrl._lastTilt = tiltTarget;
	}

	var brightness = device.getBrightness() / 100;

	// UDP fast path: binary DMXRC packet
	if (udpEnabled && ctrl._udpIndex >= 0) {
		var udpPort = srv.udpPort || (srv.port + 1);
		var ip = srv.host;
		var brightnessUint8 = Math.round(brightness * 255);
		var packet;

		if (ctrl._isMover && (panTarget !== 0xFFFF || tiltTarget !== 0xFFFF)) {
			packet = buildDmxrcMovementPacket(ctrl._udpIndex, r, g, b, brightnessUint8, panTarget, tiltTarget);
		} else {
			packet = buildDmxrcPacket(ctrl._udpIndex, r, g, b, brightnessUint8);
		}

		try {
			udp.send(ip, udpPort, packet, 1); // BIG_ENDIAN = 1
		} catch (e) {
			if (enableDebugLog === "true") {
				device.log("DMXr: UDP send error - " + e);
			}
		}

		return;
	}

	// HTTP fallback
	var url = getServerUrlFor(srv, "/update/colors");

	var payload = JSON.stringify({
		fixtures: [{
			id: ctrl._fixtureId,
			r: r,
			g: g,
			b: b,
			brightness: brightness,
		}],
	});

	try {
		var xhr = new XMLHttpRequest();
		xhr.open("POST", url, true); // async=true (non-blocking fallback)
		xhr.setRequestHeader("Content-Type", "application/json");
		xhr.send(payload);

		if (enableDebugLog === "true") {
			device.log(
				"DMXr: " + ctrl.name +
				" R:" + r + " G:" + g + " B:" + b +
				" Br:" + brightness.toFixed(2) + " (HTTP)"
			);
		}
	} catch (e) {
		if (enableDebugLog === "true") {
			device.log("DMXr: Send error - " + e);
		}
	}
}

export function Shutdown() {
	var ctrl = controller;
	var srv = ctrl._server;

	// UDP blackout (fire-and-forget, best-effort)
	if (udpEnabled) {
		try {
			var udpPort = srv.udpPort || (srv.port + 1);
			var ip = srv.host;
			var packet = buildBlackoutPacket();
			udp.send(ip, udpPort, packet, 1);
		} catch (e) {
			// best-effort
		}
	}

	// HTTP blackout (guaranteed delivery fallback via sync XHR)
	try {
		var xhr = new XMLHttpRequest();
		xhr.open("POST", getServerUrlFor(srv, "/update/colors"), false);
		xhr.setRequestHeader("Content-Type", "application/json");
		xhr.send(JSON.stringify({
			fixtures: [{ id: ctrl._fixtureId, r: 0, g: 0, b: 0, brightness: 0 }],
		}));
	} catch (e) {
		// Server may already be down
	}

	if (enableDebugLog === "true") {
		device.log("DMXr: Shutdown " + ctrl.name);
	}
}

// --------------------------------<( Plugin Update Check )>-------------------------------
// Fetches the latest DMXr.js from GitHub once per session to compare Version().
// Runs synchronously but only fires once, so the ~20KB fetch is negligible.

function checkForPluginUpdate() {
	if (updateCheckDone) return;
	updateCheckDone = true;

	try {
		var xhr = new XMLHttpRequest();
		xhr.open("GET", UPDATE_CHECK_URL, false);
		xhr.send();

		if (xhr.status !== 200) return;

		var match = xhr.responseText.match(/export function Version\(\)\s*\{\s*return\s*"([^"]+)"/);
		if (match && match[1] !== Version()) {
			service.log("DMXr: Update available! You have v" + Version() + ", latest is v" + match[1]);
			service.log("DMXr: To update — close SignalRGB, delete the addon cache folder, and reopen SignalRGB.");
		}
	} catch (e) {
		// Update check is best-effort — network may be unavailable
	}
}

// --------------------------------<( Discovery Service )>--------------------------------

export function DiscoveryService() {
	this.IconUrl = "https://raw.githubusercontent.com/thewrz/DMXr/main/docs/images/DMXr-logo-square.png";
	this.MDns = ["_dmxr._tcp.local."];
	this.knownFixtures = {};
	this.pollInterval = 2000;
	this.lastPollTime = 0;

	this.connect = function (devices) {
		for (var i = 0; i < devices.length; i++) {
			var dev = devices[i];

			if (!dev.ip || !dev.port) {
				continue;
			}

			// Determine server identity — prefer TXT serverId, fall back to ip:port
			var sid = (dev.txt && dev.txt.serverId) ? dev.txt.serverId : (dev.ip + ":" + dev.port);
			var sname = (dev.txt && dev.txt.serverName) ? dev.txt.serverName : "";
			var udpPort = (dev.txt && dev.txt.udpPort) ? (parseInt(dev.txt.udpPort, 10) || null) : null;

			serverRegistry[sid] = {
				serverId: sid,
				serverName: sname,
				host: dev.ip,
				port: dev.port,
				udpPort: udpPort,
				lastSeen: Date.now(),
				healthy: true,
			};

			if (enableDebugLog === "true") {
				service.log(
					"DMXr: mDNS discovered server " + (sname || sid.slice(0, 8)) +
					" at " + dev.ip + ":" + dev.port +
					(udpPort ? " (UDP: " + udpPort + ")" : "")
				);
			}
		}
	};

	this.forceDiscover = function (ipaddress) {
		var port = parseInt(serverPort, 10) || 8080;
		var sid = ipaddress + ":" + port;

		serverRegistry[sid] = {
			serverId: sid,
			serverName: "",
			host: ipaddress,
			port: port,
			udpPort: null,
			lastSeen: Date.now(),
			healthy: true,
		};

		if (enableDebugLog === "true") {
			service.log("DMXr: Manual discover " + ipaddress + ":" + port);
		}
	};

	this.removedDevices = function (deviceId) {
		var ctrl = service.getController(deviceId);

		if (ctrl) {
			service.removeController(ctrl);
			delete this.knownFixtures[deviceId];
		}
	};

	var self = this;

	this.Update = function () {
		var now = Date.now();

		if (now - self.lastPollTime < self.pollInterval) {
			return;
		}

		self.lastPollTime = now;

		// One-time plugin update check (best-effort, non-blocking on failure)
		checkForPluginUpdate();

		// Prune stale servers
		var serverKeys = Object.keys(serverRegistry);
		for (var s = 0; s < serverKeys.length; s++) {
			var srv = serverRegistry[serverKeys[s]];
			if (now - srv.lastSeen > STALE_TIMEOUT_MS) {
				// Remove all fixtures belonging to this server
				for (var fid in self.knownFixtures) {
					if (self.knownFixtures[fid] === srv.serverId) {
						var existingCtrl = service.getController(fid);
						if (existingCtrl) {
							service.removeController(existingCtrl);
						}
						delete self.knownFixtures[fid];

						if (enableDebugLog === "true") {
							service.log("DMXr: Removed " + fid + " (server gone)");
						}
					}
				}
				delete serverRegistry[serverKeys[s]];

				if (enableDebugLog === "true") {
					service.log("DMXr: Pruned stale server " + serverKeys[s]);
				}
			}
		}

		// Always probe the manual host:port — this is the primary fallback
		// when mDNS doesn't work (VMs, firewalls, no Bonjour on Windows).
		// probeManualServer() uses /health to learn the real serverId so it
		// deduplicates naturally if mDNS also discovers the same server.
		probeManualServer();

		// Poll each server
		serverKeys = Object.keys(serverRegistry);
		for (var k = 0; k < serverKeys.length; k++) {
			pollServerFixtures(self, serverRegistry[serverKeys[k]]);
		}

		// Serialize registry snapshot for QML settings panel consumption
		try {
			var snapshot = {};
			var skeys = Object.keys(serverRegistry);
			for (var r = 0; r < skeys.length; r++) {
				var entry = serverRegistry[skeys[r]];
				snapshot[skeys[r]] = {
					serverId: entry.serverId,
					serverName: entry.serverName,
					host: entry.host,
					port: entry.port,
					udpPort: entry.udpPort,
					healthy: entry.healthy,
					fixtureCount: entry.fixtureCount || 0,
				};
			}
			service.saveSetting("DMXr", "serverRegistry", JSON.stringify(snapshot));
		} catch (e) { /* saveSetting may not exist in all JS contexts */ }
	};
}

function pollServerFixtures(disco, server) {
	var url = getServerUrlFor(server, "/fixtures");

	try {
		var xhr = new XMLHttpRequest();
		xhr.open("GET", url, false);
		xhr.send();

		if (xhr.status !== 200) {
			server.healthy = false;
			return;
		}

		server.healthy = true;
		server.lastSeen = Date.now();

		// Update registry if this server was a fallback
		if (!serverRegistry[server.serverId]) {
			serverRegistry[server.serverId] = server;
		}

		var serverFixtures = JSON.parse(xhr.responseText);
		server.fixtureCount = serverFixtures.length;

		// Collect all fixture names across all servers for collision detection
		var nameCountMap = buildNameCountMap(serverFixtures, server.serverId);

		var serverIds = {};

		for (var i = 0; i < serverFixtures.length; i++) {
			var fixture = serverFixtures[i];
			var namespacedId = server.serverId + "/" + fixture.id;
			serverIds[namespacedId] = true;

			if (!disco.knownFixtures[namespacedId]) {
				// Check if another server has a fixture with the same name
				var displayName = fixture.name;
				if (nameCountMap[fixture.name] > 1 && server.serverName) {
					displayName = fixture.name + " (" + server.serverName + ")";
				}

				var bridge = new DMXrBridge(fixture, i, server, displayName);
				service.addController(bridge);
				service.announceController(bridge);
				disco.knownFixtures[namespacedId] = server.serverId;

				if (enableDebugLog === "true") {
					service.log("DMXr: Discovered " + displayName +
						" (id: " + namespacedId + ", udpIdx: " + i +
						", server: " + (server.serverName || server.serverId.slice(0, 8)) + ")");
				}
			} else {
				// Update UDP index in case fixture order changed
				var existingCtrl = service.getController(namespacedId);
				if (existingCtrl) {
					existingCtrl._udpIndex = i;
				}
			}
		}

		// Remove fixtures no longer on this server
		for (var id in disco.knownFixtures) {
			if (disco.knownFixtures[id] === server.serverId && !serverIds[id]) {
				var existing = service.getController(id);

				if (existing) {
					service.removeController(existing);
				}

				delete disco.knownFixtures[id];

				if (enableDebugLog === "true") {
					service.log("DMXr: Removed " + id);
				}
			}
		}
	} catch (e) {
		server.healthy = false;

		if (enableDebugLog === "true") {
			service.log("DMXr: Poll error for " +
				(server.serverName || server.serverId.slice(0, 8)) + " - " + e);
		}
	}
}

// Build a map of fixture name -> count across all servers for collision detection
function buildNameCountMap(currentFixtures, currentServerId) {
	var counts = {};

	// Count names from other servers' known fixtures
	var allKeys = Object.keys(serverRegistry);
	for (var s = 0; s < allKeys.length; s++) {
		var sid = allKeys[s];
		if (sid === currentServerId) continue;

		// Check existing controllers for name collisions
		for (var fid in serverRegistry) {
			// We only know names of fixtures we've already discovered
			var ctrl = service.getController(sid + "/" + fid);
			if (ctrl) {
				var baseName = ctrl.fixtureConfig ? ctrl.fixtureConfig.name : ctrl.name;
				counts[baseName] = (counts[baseName] || 0) + 1;
			}
		}
	}

	// Count names from current server's fixtures
	for (var i = 0; i < currentFixtures.length; i++) {
		var name = currentFixtures[i].name;
		counts[name] = (counts[name] || 0) + 1;
	}

	return counts;
}

// --------------------------------<( Manual Server Probe )>--------------------------------
// Probes the manual serverHost:serverPort via /health to learn its real serverId.
// This is the fallback when mDNS doesn't work (Windows without Bonjour, VMs, etc.).
// If the server is already in the registry (found via mDNS), this is a no-op.

function probeManualServer() {
	// Build list of host:port pairs to probe
	var targets = [];
	var seen = {};

	// Helper: add target if not already in list
	function addTarget(h, p) {
		var key = h + ":" + p;
		if (!seen[key]) {
			seen[key] = true;
			targets.push({ host: h, port: p });
		}
	}

	// Primary manual server (ControllableParameter)
	var host = serverHost || "127.0.0.1";
	var port = parseInt(serverPort, 10) || 8080;
	addTarget(host, port);

	// QML-saved settings (service.saveSetting store) — the QML panel saves
	// serverHost/serverPort separately from ControllableParameters
	try {
		var qmlHost = service.getSetting("DMXr", "serverHost");
		var qmlPort = service.getSetting("DMXr", "serverPort");
		if (qmlHost && qmlHost !== "") {
			var qp = parseInt(qmlPort, 10) || 8080;
			addTarget(qmlHost, qp);
		}
	} catch (e) {
		// service.getSetting may not be available in all contexts
	}

	// Additional servers (comma-separated "ip:port" entries)
	if (additionalServers) {
		var parts = additionalServers.split(",");
		for (var p = 0; p < parts.length; p++) {
			var entry = parts[p].replace(/\s/g, "");
			if (!entry) continue;
			var colonIdx = entry.lastIndexOf(":");
			if (colonIdx > 0) {
				var aHost = entry.substring(0, colonIdx);
				var aPort = parseInt(entry.substring(colonIdx + 1), 10);
				if (aHost && aPort > 0) {
					addTarget(aHost, aPort);
				}
			} else {
				// Bare IP — use default port
				addTarget(entry, 8080);
			}
		}
	}

	for (var t = 0; t < targets.length; t++) {
		probeOneServer(targets[t].host, targets[t].port);
	}
}

function probeOneServer(host, port) {
	// Skip if this exact host:port is already tracked by a healthy server
	var keys = Object.keys(serverRegistry);
	for (var i = 0; i < keys.length; i++) {
		var existing = serverRegistry[keys[i]];
		if (existing.host === host && existing.port === port && existing.healthy) {
			return;
		}
	}

	try {
		var xhr = new XMLHttpRequest();
		xhr.open("GET", "http://" + host + ":" + port + "/health", false);
		xhr.send();

		if (xhr.status !== 200) {
			return;
		}

		var health = JSON.parse(xhr.responseText);
		var sid = health.serverId || (host + ":" + port);

		// Don't overwrite an mDNS-discovered entry that has a different address
		if (serverRegistry[sid] && serverRegistry[sid].healthy) {
			return;
		}

		serverRegistry[sid] = {
			serverId: sid,
			serverName: health.serverName || "",
			host: host,
			port: port,
			udpPort: health.udpPort || null,
			lastSeen: Date.now(),
			healthy: true,
		};

		if (enableDebugLog === "true") {
			service.log("DMXr: Manual probe found server " +
				(health.serverName || sid.slice(0, 8)) +
				" at " + host + ":" + port);
		}
	} catch (e) {
		// Server unreachable — that's fine, mDNS may find others
	}
}

// --------------------------------<( Fixture Category Derivation )>-----------------------
// Lightweight port of classify-fixture logic for category icons.

function deriveCategoryFromChannels(channels, name) {
	if (!channels || channels.length === 0) return "Other";
	var hasPan = false, hasTilt = false, hasGobo = false, hasPrism = false;
	var hasColorWheel = false, hasStrobe = false, hasColor = false;
	var hasUvOnly = true, hasIntensity = false, allDimmer = true;
	for (var i = 0; i < channels.length; i++) {
		var t = channels[i].type;
		if (t === "Pan") hasPan = true;
		else if (t === "Tilt") hasTilt = true;
		else if (t === "Gobo") hasGobo = true;
		else if (t === "Prism") hasPrism = true;
		else if (t === "ColorWheel") hasColorWheel = true;
		else if (t === "Strobe" || t === "ShutterStrobe") hasStrobe = true;
		else if (t === "Intensity") hasIntensity = true;
		if (t === "ColorIntensity") {
			hasColor = true;
			if (channels[i].color !== "UV") hasUvOnly = false;
		}
		if (t !== "Intensity" && t !== "Generic" && t !== "NoFunction" && t !== "ColorIntensity") {
			allDimmer = false;
		}
	}
	if (hasPan && hasTilt) return "Moving Head";
	if (hasPan || hasTilt) return "Scanner";
	if (hasGobo || hasPrism || hasColorWheel) return "Effect";
	if (hasStrobe && !hasColor) return "Strobe";
	if (hasColor && hasUvOnly) return "Blacklight";
	if (hasColor) return "Color Changer";
	if (allDimmer && hasIntensity && !hasColor) return "Dimmer";

	// Name heuristic as last resort
	if (name) {
		var n = name.toLowerCase();
		if (/\blaser\b/.test(n)) return "Laser";
		if (/\bsmoke\b|\bfog\b|\bhaze\b|\bhurricane\b/.test(n)) return "Smoke Machine";
		if (/\bblinder\b/.test(n)) return "Blinder";
		if (/\bstrobe\b/.test(n)) return "Strobe";
		if (/\bbar\b|\bstrip\b|\bpixel\b/.test(n)) return "Pixel Bar";
		if (/\bspot\b|\bpar\b/.test(n)) return "Color Changer";
	}

	return "Other";
}

// --------------------------------<( Bridge Data Class )>--------------------------------
// Data-only object passed to service.addController(). Device operations happen in
// the top-level Initialize/Render/Shutdown exports, not here.

function DMXrBridge(fixture, udpIndex, server, displayName) {
	this.id = server.serverId + "/" + fixture.id;
	this.name = displayName || fixture.name;

	// Detect movers: fixtures with Pan or Tilt channels get a 3x3 grid
	var channels = fixture.channels || [];
	var isMover = false;
	for (var c = 0; c < channels.length; c++) {
		var chType = channels[c].type;
		if (chType === "Pan" || chType === "Tilt") {
			isMover = true;
			break;
		}
	}
	this._isMover = isMover;

	if (isMover) {
		this.width = 3;
		this.height = 3;
		this.ledNames = [];
		this.ledPositions = [];
		for (var y = 0; y < 3; y++) {
			for (var x = 0; x < 3; x++) {
				this.ledNames.push(this.name + " [" + x + "," + y + "]");
				this.ledPositions.push([x, y]);
			}
		}
	} else {
		this.width = 1;
		this.height = 1;
		this.ledNames = [this.name];
		this.ledPositions = [[0, 0]];
	}

	this.fixtureConfig = fixture;

	// Original fixture ID for API calls (not namespaced)
	this._fixtureId = fixture.id;

	// Reference to the server registry entry for routing
	this._server = server;

	// UDP fixture index (position in server's fixture array)
	this._udpIndex = typeof udpIndex === "number" ? udpIndex : -1;

	// Derive fixture category for icon (prefer persisted category)
	this._category = fixture.category || deriveCategoryFromChannels(fixture.channels || [], fixture.name);

	// Runtime state (managed by top-level lifecycle exports)
	this._lastR = -1;
	this._lastG = -1;
	this._lastB = -1;
	this._lastSendTime = 0;
	this._lastPan = 0xFFFF;
	this._lastTilt = 0xFFFF;
}
